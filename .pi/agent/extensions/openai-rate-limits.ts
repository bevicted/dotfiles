import { Buffer } from "node:buffer";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "openai-codex";
const OFFICIAL_PROVIDER_NAME = "OpenAI Codex";
const OFFICIAL_OAUTH_NAME = "OpenAI (ChatGPT Plus/Pro)";
const OFFICIAL_BASE_URL = "https://chatgpt.com/backend-api";
const OFFICIAL_API = "openai-codex-responses";
const STATUS_KEY = "rate-limits";
const USAGE_URL = `${OFFICIAL_BASE_URL}/wham/usage`;
const REQUEST_TIMEOUT_MS = 5_000;
const REFRESH_INTERVAL_MS = 5 * 60_000;

type JsonObject = Record<string, unknown>;

export type UsageWindow = {
	usedPercent: number;
	windowSeconds: number;
	resetsAt: number;
};

export type UsageSnapshot = {
	primary?: UsageWindow;
	secondary?: UsageWindow;
};

function asObject(value: unknown): JsonObject | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as JsonObject)
		: undefined;
}

function isPositiveSafeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseUsageWindow(value: unknown): UsageWindow | undefined {
	const window = asObject(value);
	if (!window) return undefined;

	const usedPercent = window.used_percent;
	const windowSeconds = window.limit_window_seconds;
	const resetsAt = window.reset_at;
	if (
		typeof usedPercent !== "number" ||
		!Number.isFinite(usedPercent) ||
		!isPositiveSafeInteger(windowSeconds) ||
		!isPositiveSafeInteger(resetsAt)
	) {
		return undefined;
	}

	return {
		usedPercent: Math.min(100, Math.max(0, usedPercent)),
		windowSeconds,
		resetsAt,
	};
}

export function parseUsageSnapshot(value: unknown): UsageSnapshot | undefined {
	const payload = asObject(value);
	const rateLimit = asObject(payload?.rate_limit);
	if (!rateLimit) return undefined;

	const primary = parseUsageWindow(rateLimit.primary_window);
	const secondary = parseUsageWindow(rateLimit.secondary_window);
	if (!primary && !secondary) return undefined;

	return {
		...(primary ? { primary } : {}),
		...(secondary ? { secondary } : {}),
	};
}

type RequestAuth = {
	bearerToken: string;
	accountId: string;
};

type ResolvedRequestAuth = Awaited<
	ReturnType<ExtensionContext["modelRegistry"]["getApiKeyAndHeaders"]>
>;

// Timed-out callers share an OAuth refresh because Pi cannot cancel auth resolution.
const authLookups = new WeakMap<object, Map<string, Promise<ResolvedRequestAuth>>>();

class UnofficialProviderError extends Error {}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
	signal.throwIfAborted();

	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			signal.removeEventListener("abort", onAbort);
			reject(signal.reason);
		};

		signal.addEventListener("abort", onAbort, { once: true });
		if (signal.aborted) {
			onAbort();
			return;
		}

		operation.then(
			(value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			},
			(error: unknown) => {
				signal.removeEventListener("abort", onAbort);
				reject(error);
			},
		);
	});
}

function getSharedRequestAuth(
	ctx: ExtensionContext,
	model: NonNullable<ExtensionContext["model"]>,
): Promise<ResolvedRequestAuth> {
	const registryKey = ctx.modelRegistry as object;
	let registryLookups = authLookups.get(registryKey);
	if (!registryLookups) {
		registryLookups = new Map<string, Promise<ResolvedRequestAuth>>();
		authLookups.set(registryKey, registryLookups);
	}

	const existing = registryLookups.get(model.provider);
	if (existing) return existing;

	const lookup = ctx.modelRegistry.getApiKeyAndHeaders(model);
	registryLookups.set(model.provider, lookup);
	lookup.then(
		() => registryLookups.delete(model.provider),
		() => registryLookups.delete(model.provider),
	);
	return lookup;
}

function isOfficialBaseUrl(value: string | undefined): boolean {
	if (!value) return false;

	try {
		const url = new URL(value);
		return (
			url.origin === "https://chatgpt.com" &&
			url.pathname.replace(/\/+$/, "") === "/backend-api" &&
			!url.username &&
			!url.password &&
			!url.search &&
			!url.hash
		);
	} catch {
		return false;
	}
}

export function isOfficialOpenAICodexProvider(
	ctx: ExtensionContext,
	model = ctx.model,
): boolean {
	if (!model || model.provider !== PROVIDER || model.api !== OFFICIAL_API) return false;
	if (!isOfficialBaseUrl(model.baseUrl)) return false;
	if (ctx.modelRegistry.getRegisteredProviderIds().includes(PROVIDER)) return false;
	if (!ctx.modelRegistry.isUsingOAuth(model)) return false;

	const provider = ctx.modelRegistry.getProvider(PROVIDER);
	return (
		provider?.id === PROVIDER &&
		provider.name === OFFICIAL_PROVIDER_NAME &&
		isOfficialBaseUrl(provider.baseUrl) &&
		provider.auth.apiKey === undefined &&
		provider.auth.oauth?.name === OFFICIAL_OAUTH_NAME &&
		provider.auth.oauth.isSubscription === true
	);
}

export function extractChatGPTAccountId(bearerToken: string): string | undefined {
	try {
		const parts = bearerToken.split(".");
		if (parts.length !== 3 || !parts[1]) return undefined;

		const payload = asObject(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
		const authClaim = asObject(payload?.["https://api.openai.com/auth"]);
		const accountId = authClaim?.chatgpt_account_id;
		return typeof accountId === "string" && accountId.length > 0 ? accountId : undefined;
	} catch {
		return undefined;
	}
}

async function resolveRequestAuth(
	ctx: ExtensionContext,
	signal: AbortSignal,
): Promise<RequestAuth | undefined> {
	signal.throwIfAborted();
	const model = ctx.model;
	if (!isOfficialOpenAICodexProvider(ctx, model)) {
		throw new UnofficialProviderError("OpenAI Codex provider identity could not be established");
	}

	const resolved = await abortable(getSharedRequestAuth(ctx, model), signal);
	signal.throwIfAborted();
	const currentModel = ctx.model;
	if (
		!currentModel ||
		currentModel.provider !== model.provider ||
		currentModel.id !== model.id ||
		!isOfficialOpenAICodexProvider(ctx, currentModel)
	) {
		throw new UnofficialProviderError("OpenAI Codex provider changed during authentication");
	}
	if (!resolved.ok || !resolved.apiKey) return undefined;

	const accountId = extractChatGPTAccountId(resolved.apiKey);
	if (!accountId) return undefined;

	return { bearerToken: resolved.apiKey, accountId };
}

export async function fetchUsageSnapshot(
	ctx: ExtensionContext,
	parentSignal: AbortSignal,
): Promise<UsageSnapshot> {
	const controller = new AbortController();
	const abortFromParent = () => controller.abort(parentSignal.reason);
	parentSignal.addEventListener("abort", abortFromParent, { once: true });
	if (parentSignal.aborted) abortFromParent();
	const timeout = setTimeout(
		() => controller.abort(new DOMException("Usage refresh timed out", "TimeoutError")),
		REQUEST_TIMEOUT_MS,
	);

	try {
		controller.signal.throwIfAborted();
		const auth = await resolveRequestAuth(ctx, controller.signal);
		controller.signal.throwIfAborted();
		if (!auth) throw new Error("OpenAI Codex OAuth auth is unavailable");

		controller.signal.throwIfAborted();
		const response = await abortable(
			fetch(USAGE_URL, {
				method: "GET",
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${auth.bearerToken}`,
					"ChatGPT-Account-Id": auth.accountId,
					originator: "pi",
				},
				signal: controller.signal,
			}),
			controller.signal,
		);
		if (!response.ok) throw new Error(`Usage request failed with HTTP ${response.status}`);

		controller.signal.throwIfAborted();
		const snapshot = parseUsageSnapshot(
			await abortable(response.json(), controller.signal),
		);
		if (!snapshot) throw new Error("Usage response did not contain a valid main rate limit");
		return snapshot;
	} finally {
		clearTimeout(timeout);
		parentSignal.removeEventListener("abort", abortFromParent);
	}
}

export function formatWindowDuration(windowSeconds: number): string {
	if (windowSeconds >= 86_400 && windowSeconds % 86_400 === 0) {
		return `${windowSeconds / 86_400}d`;
	}
	if (windowSeconds >= 3_600 && windowSeconds % 3_600 === 0) {
		return `${windowSeconds / 3_600}h`;
	}
	if (windowSeconds >= 60 && windowSeconds % 60 === 0) {
		return `${windowSeconds / 60}m`;
	}
	return `${windowSeconds}s`;
}

export function formatResetCountdown(resetsAt: number, nowMs = Date.now()): string {
	const seconds = Math.floor(resetsAt - nowMs / 1_000);
	if (seconds <= 0) return "now";
	if (seconds >= 86_400) return `${Math.floor(seconds / 86_400)}d`;
	if (seconds >= 3_600) return `${Math.floor(seconds / 3_600)}h`;
	return `${Math.floor(seconds / 60)}m`;
}

function formatUsageWindow(window: UsageWindow, nowMs: number): string {
	return `${formatWindowDuration(window.windowSeconds)} ${Math.round(window.usedPercent)}% ~${formatResetCountdown(window.resetsAt, nowMs)}`;
}

export function formatUsageSnapshot(snapshot: UsageSnapshot, nowMs = Date.now()): string {
	return [
		snapshot.primary ? formatUsageWindow(snapshot.primary, nowMs) : undefined,
		snapshot.secondary ? formatUsageWindow(snapshot.secondary, nowMs) : undefined,
	]
		.filter((segment): segment is string => segment !== undefined)
		.join(" ");
}

function renderStatus(ctx: ExtensionContext, snapshot: UsageSnapshot, stale: boolean): void {
	const usage = ctx.ui.theme.fg("dim", formatUsageSnapshot(snapshot));
	const staleMarker = stale ? ` ${ctx.ui.theme.fg("warning", "(stale)")}` : "";
	ctx.ui.setStatus(STATUS_KEY, usage + staleMarker);
}

export default function openAIRateLimits(pi: ExtensionAPI): void {
	let lastGood: UsageSnapshot | undefined;
	let inFlight: Promise<void> | undefined;
	let fetchController: AbortController | undefined;
	let currentCtx: ExtensionContext | undefined;
	let generation = 0;
	let rerunRequested = false;
	let sessionActive = false;
	let providerActive = false;
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	function canRefresh(ctx: ExtensionContext): boolean {
		return sessionActive && providerActive && ctx.mode === "tui";
	}

	function refresh(ctx: ExtensionContext): void {
		currentCtx = ctx;
		if (!canRefresh(ctx)) return;
		if (inFlight) {
			rerunRequested = true;
			return;
		}

		const requestGeneration = generation;
		const controller = new AbortController();
		fetchController = controller;

		const request = (async () => {
			try {
				const snapshot = await fetchUsageSnapshot(ctx, controller.signal);
				if (requestGeneration !== generation || !canRefresh(ctx)) return;
				lastGood = snapshot;
				renderStatus(ctx, snapshot, false);
			} catch (error) {
				if (requestGeneration !== generation || !canRefresh(ctx)) return;
				if (error instanceof UnofficialProviderError) {
					lastGood = undefined;
					ctx.ui.setStatus(STATUS_KEY, undefined);
				} else if (lastGood) {
					renderStatus(ctx, lastGood, true);
				}
			} finally {
				if (inFlight === request) inFlight = undefined;
				if (fetchController === controller) fetchController = undefined;

				if (rerunRequested) {
					rerunRequested = false;
					const latestCtx = currentCtx;
					if (latestCtx && canRefresh(latestCtx)) refresh(latestCtx);
				}
			}
		})();

		inFlight = request;
	}

	function stopPolling(): void {
		if (!pollTimer) return;
		clearInterval(pollTimer);
		pollTimer = undefined;
	}

	function leaveProvider(ctx: ExtensionContext, discardSnapshot = true): void {
		providerActive = false;
		generation += 1;
		rerunRequested = false;
		stopPolling();
		fetchController?.abort();
		ctx.ui.setStatus(STATUS_KEY, undefined);
		if (discardSnapshot) lastGood = undefined;
	}

	function enterProvider(ctx: ExtensionContext): void {
		currentCtx = ctx;
		if (
			!sessionActive ||
			ctx.mode !== "tui" ||
			!isOfficialOpenAICodexProvider(ctx) ||
			/^(1|true|yes)$/i.test(process.env.PI_OFFLINE ?? "")
		) {
			leaveProvider(ctx);
			return;
		}

		if (!providerActive) {
			providerActive = true;
			generation += 1;
		}
		if (!lastGood) ctx.ui.setStatus(STATUS_KEY, undefined);

		if (!pollTimer) {
			pollTimer = setInterval(() => {
				const latestCtx = currentCtx;
				if (latestCtx) refresh(latestCtx);
			}, REFRESH_INTERVAL_MS);
			pollTimer.unref?.();
		}

		refresh(ctx);
	}

	pi.on("session_start", (_event, ctx) => {
		sessionActive = true;
		enterProvider(ctx);
	});

	pi.on("model_select", (event, ctx) => {
		currentCtx = ctx;
		if (!sessionActive) return;
		if (event.model.provider === PROVIDER) enterProvider(ctx);
		else leaveProvider(ctx);
	});

	pi.on("agent_settled", (_event, ctx) => {
		currentCtx = ctx;
		if (canRefresh(ctx)) refresh(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		sessionActive = false;
		leaveProvider(ctx);
		currentCtx = undefined;
	});
}
