import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { RESEARCH_MAX_BYTES, RESEARCH_MAX_LINES } from "./research.ts";

export const RESEARCH_ISOLATION_ENTRY = "research-isolation";
export const RESEARCH_ISOLATION_ERROR = "Research isolation failure: private child evidence was removed before the provider request. Inspect Research details.";

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
type SafeContent = Array<{ type: "text"; text: string }>;

export interface ResearchIsolationTelemetry {
	toolCallId: string;
	/** Exact bytes of this Research tool-result envelope in model context. */
	modelVisibleBytes: number;
	modelVisibleTokenEstimate: number;
	/** Exact bytes delivered to the provider after boundary sanitization. */
	providerPayloadBytes?: number;
	providerPayloadTokenEstimate?: number;
	/** Audit-only bytes before a rejected provider payload was sanitized. */
	attemptedProviderPayloadBytes?: number;
	leakDetected: boolean;
	childUsage: Usage;
	/** Independently aggregated Research lifecycle usage, not a reference to childUsage. */
	totalUsage: Usage;
}

interface PrivateRun {
	toolCallId: string;
	safeContent: SafeContent;
	privateFragments: string[];
	childUsage: Usage;
	totalUsage: Usage;
	telemetry?: ResearchIsolationTelemetry;
	/** This result appeared in a sanitized context for its parent request. */
	contextPresented: boolean;
	contextLeakDetected: boolean;
}

interface ResearchToolResult {
	content: Array<{ type: string; text?: string }>;
	details?: {
		usage?: unknown;
		results?: Array<{ messages?: unknown[]; usage?: unknown }>;
	};
}

type BoundaryAPI = Pick<ExtensionAPI, "on"> & { appendEntry?: ExtensionAPI["appendEntry"] };

function serializedBytes(value: unknown): number {
	return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
}

function usage(value: unknown): Usage {
	const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
	const number = (key: string) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]) ? candidate[key] as number : 0;
	return { input: number("input"), output: number("output"), cacheRead: number("cacheRead"), cacheWrite: number("cacheWrite"), cost: number("cost") };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedText(text: string): boolean {
	return Buffer.byteLength(text, "utf8") <= RESEARCH_MAX_BYTES && text.split("\n").length <= RESEARCH_MAX_LINES;
}

/** Research is deliberately a single bounded text result, never a block passthrough. */
function safeContent(value: unknown): SafeContent | undefined {
	if (!Array.isArray(value) || value.length !== 1) return undefined;
	const part = value[0];
	if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string" || !isBoundedText(part.text)) return undefined;
	return [{ type: "text", text: part.text }];
}

function sameContent(left: SafeContent | undefined, right: SafeContent | undefined): boolean {
	return Boolean(left && right && left[0].text === right[0].text);
}

function addPrivateValue(value: unknown, fragments: Set<string>, skipText = false): void {
	if (typeof value === "string") {
		if (!skipText && value) fragments.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) addPrivateValue(item, fragments, skipText);
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, item] of Object.entries(value)) {
		// Protocol discriminators occur in ordinary parent/provider payloads. Data
		// values remain tainted; unusual long keys cover transformed non-text data.
		if (["type", "role", "toolName", "name", "content", "text", "id", "arguments", "input", "url"].includes(key)) {
			if (skipText && key === "text") continue;
			if (["type", "role", "toolName", "name"].includes(key)) continue;
		} else if (key.length >= 12) fragments.add(key);
		addPrivateValue(item, fragments, skipText && key === "text");
	}
}

/**
 * Preserve only the final assistant text as a candidate synthesis. Every other
 * child content field is tainted, independent of its original JSON shape.
 */
function privateFragments(messages: readonly unknown[]): string[] {
	const fragments = new Set<string>();
	const lastAssistant = messages.findLastIndex((message) => isRecord(message) && message.role === "assistant");
	for (const [index, message] of messages.entries()) {
		if (!isRecord(message) || !Array.isArray(message.content)) continue;
		if (message.role === "toolResult") {
			// Raw tool-result values are private. Their exact values identify a
			// passthrough without treating cited URLs as private evidence.
			addPrivateValue(message.content, fragments);
			continue;
		}
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (!isRecord(part)) {
				addPrivateValue(part, fragments);
				continue;
			}
			if (index === lastAssistant && part.type === "text") continue;
			if (part.type === "toolCall") {
				// A transformed tool call is detected by its opaque call ID. URLs
				// are allowed to recur in the bounded report as citations.
				if (typeof part.id === "string" && part.id) fragments.add(part.id);
				continue;
			}
			addPrivateValue(part, fragments);
		}
	}
	return [...fragments];
}

function containsPrivate(value: unknown, fragments: readonly string[]): boolean {
	if (fragments.length === 0) return false;
	if (typeof value === "string") return fragments.some((fragment) => value.includes(fragment));
	if (Array.isArray(value)) return value.some((item) => containsPrivate(item, fragments));
	if (!isRecord(value)) return false;
	return Object.entries(value).some(([key, item]) => containsPrivate(key, fragments) || containsPrivate(item, fragments));
}

function isResearchToolResult(message: unknown): message is AgentMessage & { role: "toolResult"; toolName: "research"; toolCallId: string } {
	return isRecord(message) && message.role === "toolResult" && message.toolName === "research" && typeof message.toolCallId === "string";
}

function toolCallIds(value: unknown, knownIds: ReadonlySet<string>, found = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) toolCallIds(item, knownIds, found);
		return found;
	}
	if (!isRecord(value)) return found;
	for (const [key, item] of Object.entries(value)) {
		if ((key === "toolCallId" || key === "tool_call_id" || key === "toolUseId" || key === "tool_use_id") && typeof item === "string" && knownIds.has(item)) found.add(item);
		toolCallIds(item, knownIds, found);
	}
	return found;
}

function isResearchEnvelope(value: Record<string, unknown>, knownIds: ReadonlySet<string>): boolean {
	if (value.toolName === "research") return true;
	return ["toolCallId", "tool_call_id", "toolUseId", "tool_use_id"].some(
		(key) => typeof value[key] === "string" && knownIds.has(value[key]),
	);
}

function safeResearchMessage(message: AgentMessage, run: PrivateRun | undefined): AgentMessage {
	const candidate = message as unknown as Record<string, unknown>;
	const content = safeContent(candidate.content);
	// The bounded Research text is the sole public channel. It may quote a
	// source or cite a URL also present in private tool results, so content
	// overlap alone is not evidence of a transcript leak.
	const unsafe = !content || (run !== undefined && !sameContent(content, run.safeContent));
	const safe: Record<string, unknown> = {
		role: "toolResult",
		toolName: "research",
		toolCallId: candidate.toolCallId,
		content: unsafe ? [{ type: "text", text: RESEARCH_ISOLATION_ERROR }] : content,
	};
	if (typeof candidate.isError === "boolean") safe.isError = candidate.isError;
	return safe as AgentMessage;
}

/** Remove tainted fields rather than recursively inserting an error per leaf. */
function removePrivateFields(value: unknown, fragments: readonly string[]): unknown {
	if (typeof value === "string" || !value || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.flatMap((item) => containsPrivate(item, fragments) ? [] : [removePrivateFields(item, fragments)]);
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([key, item]) => !containsPrivate(key, fragments) && !containsPrivate(item, fragments))
			.map(([key, item]) => [key, removePrivateFields(item, fragments)]),
	);
}

function safeGenericMessage(message: AgentMessage, fragments: readonly string[]): AgentMessage {
	if (!containsPrivate(message, fragments)) return message;
	const cleaned = removePrivateFields(message, fragments);
	const base = isRecord(cleaned) ? cleaned : { role: (message as { role?: unknown }).role };
	// One error replaces the whole affected message content, not every marker.
	return { ...base, content: [{ type: "text", text: RESEARCH_ISOLATION_ERROR }] } as AgentMessage;
}

function researchMessages(messages: unknown, toolCallId: string): unknown[] {
	if (!Array.isArray(messages)) return [];
	return messages.filter((message) => isResearchToolResult(message) && message.toolCallId === toolCallId);
}

function providerContentIsSafe(value: unknown, run: PrivateRun | undefined): boolean {
	if (!run) return safeContent(value) !== undefined || (typeof value === "string" && isBoundedText(value));
	return (typeof value === "string" && value === run.safeContent[0].text) || sameContent(safeContent(value), run.safeContent);
}

/**
 * Rebuild a provider Research envelope instead of walking it. Provider formats
 * differ, but these fields are sufficient to identify a tool result and carry
 * its single public text result. In particular, no child-call structure can
 * survive inside a correlated envelope.
 */
function safeProviderResearchEnvelope(value: Record<string, unknown>, run: PrivateRun | undefined): Record<string, unknown> {
	const content = value.content;
	const contentIsSafe = providerContentIsSafe(content, run);
	const safe: Record<string, unknown> = {};
	if (typeof value.role === "string") safe.role = value.role;
	if (value.type === "tool_result" || value.type === "toolResult") safe.type = value.type;
	if (value.toolName === "research") safe.toolName = "research";
	for (const key of ["toolCallId", "tool_call_id", "toolUseId", "tool_use_id"] as const)
		if (typeof value[key] === "string") safe[key] = value[key];
	if (typeof value.isError === "boolean") safe.isError = value.isError;
	safe.content = contentIsSafe
		? content
		: typeof content === "string"
			? RESEARCH_ISOLATION_ERROR
			: [{ type: "text", text: RESEARCH_ISOLATION_ERROR }];
	return safe;
}

interface ProviderSanitization {
	payload: unknown;
	changed: boolean;
	leakingRunIds: Set<string>;
	providerRunIds: Set<string>;
}

/**
 * Providers use different message representations. Rebuild only correlated
 * Research envelopes, and prune tainted transformed child structures elsewhere.
 */
function sanitizeProvider(payload: unknown, runs: readonly PrivateRun[]): ProviderSanitization {
	const byId = new Map(runs.map((run) => [run.toolCallId, run]));
	const knownIds = new Set(byId.keys());
	const providerRunIds = toolCallIds(payload, knownIds);
	const leakingRunIds = new Set(runs.filter((run) => run.contextLeakDetected).map((run) => run.toolCallId));
	const allFragments = runs.flatMap((run) => run.privateFragments);
	let changed = false;
	let wroteFallbackError = false;

	const visit = (value: unknown): unknown => {
		if (Array.isArray(value)) {
			const next = value.map(visit);
			if (next.some((item, index) => item !== value[index])) changed = true;
			return next;
		}
		if (!isRecord(value)) return value;
		const ids = toolCallIds(value, knownIds);
		const run = [...ids].map((id) => byId.get(id)).find((candidate): candidate is PrivateRun => candidate !== undefined);
		const research = isResearchEnvelope(value, knownIds);
		const privateHere = containsPrivate(value, allFragments);
		if (research) {
			const safe = safeProviderResearchEnvelope(value, run);
			if (!providerContentIsSafe(value.content, run) && run)
				leakingRunIds.add(run.toolCallId);
			if (JSON.stringify(safe) !== JSON.stringify(value)) changed = true;
			return safe;
		}
		if (!research && privateHere && typeof value.role === "string") {
			for (const candidate of runs)
				if (containsPrivate(value, candidate.privateFragments)) leakingRunIds.add(candidate.toolCallId);
			changed = true;
			return { role: value.role, content: typeof value.content === "string" ? RESEARCH_ISOLATION_ERROR : [{ type: "text", text: RESEARCH_ISOLATION_ERROR }] };
		}
		const next: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			if (containsPrivate(item, allFragments) && !Array.isArray(item) && !isRecord(item)) {
				// This is a tainted scalar in a transformed child block. Its enclosing
				// message will retain only the bounded fallback error below.
				changed = true;
				continue;
			}
			next[key] = visit(item);
		}
		if (privateHere && !wroteFallbackError && "content" in next) {
			next.content = typeof value.content === "string" ? RESEARCH_ISOLATION_ERROR : [{ type: "text", text: RESEARCH_ISOLATION_ERROR }];
			for (const run of runs)
				if (containsPrivate(value, run.privateFragments)) leakingRunIds.add(run.toolCallId);
			wroteFallbackError = true;
			changed = true;
		}
		return next;
	};

	return { payload: visit(payload), changed, leakingRunIds, providerRunIds };
}

/** Tracks completed Research results until their own parent provider request. */
export class ResearchBoundaryTracker {
	private readonly pending: PrivateRun[] = [];
	/** Avoid rehydrating historical parent results on every later request. */
	private readonly observed = new Set<string>();

	record(result: ResearchToolResult, toolCallId: string): void {
		this.observed.add(toolCallId);
		const child = result.details?.results?.[0];
		const content = safeContent(result.content);
		if (!child || !content) return;
		const existing = this.pending.findIndex((run) => run.toolCallId === toolCallId);
		if (existing >= 0) this.pending.splice(existing, 1);
		this.pending.push({
			toolCallId,
			safeContent: content,
			privateFragments: privateFragments(child.messages ?? []),
			childUsage: usage(child.usage),
			totalUsage: usage(result.details?.usage),
			contextPresented: false,
			contextLeakDetected: false,
		});
	}

	inspectContext(messages: AgentMessage[]): { leaked: boolean; messages?: AgentMessage[] } {
		// A later Pi invocation creates a new extension instance. Rebuild the
		// private transcript fingerprints from the persisted parent audit entry
		// before sanitizing its first context.
		for (const message of messages)
			if (isResearchToolResult(message) && !this.observed.has(message.toolCallId))
				this.record(message as unknown as ResearchToolResult, message.toolCallId);
		const byId = new Map(this.pending.map((run) => [run.toolCallId, run]));
		let leaked = false;
		const delivered = messages.map((message) => {
			if (isResearchToolResult(message)) {
				const run = byId.get(message.toolCallId);
				const safe = safeResearchMessage(message, run);
				if (safe.content[0]?.text === RESEARCH_ISOLATION_ERROR) {
					leaked ||= run !== undefined;
					if (run) run.contextLeakDetected = true;
				}
				return safe;
			}
			const affected = this.pending.some((run) => containsPrivate(message, run.privateFragments));
			if (affected) leaked = true;
			return safeGenericMessage(message, this.pending.flatMap((run) => run.privateFragments));
		});
		this.captureContextTelemetry(delivered);
		return { leaked, messages: delivered };
	}

	inspectProvider(payload: unknown): { leaked: boolean; payload?: unknown; runIds: Set<string> } {
		const sanitized = sanitizeProvider(payload, this.pending);
		const deliveredBytes = serializedBytes(sanitized.payload);
		const attemptedBytes = serializedBytes(payload);
		for (const run of this.pending) {
			if (!sanitized.providerRunIds.has(run.toolCallId) || !run.contextPresented) continue;
			const telemetry = run.telemetry ?? this.newTelemetry(run, []);
			telemetry.providerPayloadBytes = deliveredBytes;
			telemetry.providerPayloadTokenEstimate = Math.ceil(deliveredBytes / 4);
			if (sanitized.changed) telemetry.attemptedProviderPayloadBytes = attemptedBytes;
			telemetry.leakDetected ||= sanitized.leakingRunIds.has(run.toolCallId);
			run.telemetry = telemetry;
		}
		const correlatedRunIds = new Set([...sanitized.providerRunIds].filter((toolCallId) => this.pending.find((run) => run.toolCallId === toolCallId)?.contextPresented));
		return { leaked: sanitized.leakingRunIds.size > 0, payload: sanitized.changed ? sanitized.payload : undefined, runIds: correlatedRunIds };
	}

	consumeTelemetry(toolCallIds: ReadonlySet<string>): ResearchIsolationTelemetry[] {
		const consumed: PrivateRun[] = [];
		for (let index = this.pending.length - 1; index >= 0; index--) {
			const run = this.pending[index];
			if (!toolCallIds.has(run.toolCallId)) continue;
			consumed.push(...this.pending.splice(index, 1));
		}
		return consumed.reverse().map((run) => run.telemetry ?? this.newTelemetry(run, []));
	}

	private captureContextTelemetry(messages: AgentMessage[]): void {
		for (const run of this.pending) {
			const visible = researchMessages(messages, run.toolCallId);
			if (visible.length === 0) continue;
			run.contextPresented = true;
			const telemetry = run.telemetry ?? this.newTelemetry(run, visible);
			telemetry.modelVisibleBytes = serializedBytes(visible);
			telemetry.modelVisibleTokenEstimate = Math.ceil(telemetry.modelVisibleBytes / 4);
			run.telemetry = telemetry;
		}
	}

	private newTelemetry(run: PrivateRun, visible: unknown[]): ResearchIsolationTelemetry {
		const modelVisibleBytes = serializedBytes(visible);
		return {
			toolCallId: run.toolCallId,
			modelVisibleBytes,
			modelVisibleTokenEstimate: Math.ceil(modelVisibleBytes / 4),
			leakDetected: run.contextLeakDetected,
			childUsage: { ...run.childUsage },
			totalUsage: { ...run.totalUsage },
		};
	}
}

/** Register both model-agnostic and provider-specific fail-closed boundaries. */
export function registerResearchBoundary(pi: BoundaryAPI, tracker: ResearchBoundaryTracker): void {
	pi.on("context", (event) => {
		const inspected = tracker.inspectContext(event.messages);
		if (!inspected.messages) return undefined;
		event.messages.splice(0, event.messages.length, ...inspected.messages);
		return { messages: inspected.messages };
	});
	pi.on("before_provider_request", (event) => {
		const inspected = tracker.inspectProvider(event.payload);
		for (const telemetry of tracker.consumeTelemetry(inspected.runIds)) pi.appendEntry?.(RESEARCH_ISOLATION_ENTRY, telemetry);
		return inspected.payload;
	});
}

export function serializedModelBytes(value: unknown): number {
	return serializedBytes(value);
}
