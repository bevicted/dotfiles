import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import {
	RESEARCH_WORK_BUDGET_ENTRY,
	isResearchWorkBudgetConfiguration,
	type ResearchWorkBudgetConfiguration,
	type ResearchWorkBudgetTelemetry,
} from "./research-budget-audit.ts";
import {
	RESEARCH_CONTEXT_ENTRY,
	type ResearchContextTelemetry,
} from "./research-context-audit.ts";
import {
	RESEARCH_FETCH_EVIDENCE_ENTRY,
	recordResearchFetchEvidence,
} from "./research-evidence.ts";
import {
	RESEARCH_CHILD_ENV,
	RESEARCH_PARENT_ENV,
	isTrustedResearchChildSession,
} from "./research-session.ts";

/**
 * Pi keeps 20k tokens after normal compaction. Keeping 12k here leaves enough
 * recent evidence for iterative work while allowing old web observations to
 * stop consuming every later provider request.
 */
export const RESEARCH_PROTECTED_RECENT_TOKENS = 12_000;
export const RESEARCH_PROTECTED_EVIDENCE_RESULTS = 3;
export const RESEARCH_PROTECTED_TOOLS = ["read", "grep", "find", "ls"] as const;
/** Reserved before dispatch so truncation can always give the child an explanation. */
export const RESEARCH_BUDGET_TRUNCATION_NOTICE =
	"[Research web evidence truncated: budget exhausted. Further web calls are blocked.]";

const WEB_TOOLS = ["websearch", "webfetch"] as const;
type WebTool = (typeof WEB_TOOLS)[number];
type TextContent = { type: "text"; text: string };
type ToolResultMessage = AgentMessage & {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: Array<{ type: string; text?: string }>;
	isError?: boolean;
	details?: unknown;
};

export type { ResearchContextTelemetry } from "./research-context-audit.ts";

export class ResearchContextTracker {
	readonly telemetry: ResearchContextTelemetry[] = [];

	record(telemetry: ResearchContextTelemetry): void {
		this.telemetry.push({ ...telemetry });
	}
}

export interface ResearchContextOptions {
	environment?: NodeJS.ProcessEnv;
	tracker?: ResearchContextTracker;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textBytes(value: unknown): number {
	return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
}

function contentText(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(part): part is TextContent =>
				isRecord(part) && part.type === "text" && typeof part.text === "string",
		)
		.map((part) => part.text)
		.join("\n");
}

function messageTokens(message: AgentMessage): number {
	const candidate = message as unknown as Record<string, unknown>;
	if (candidate.role === "assistant" && Array.isArray(candidate.content)) {
		let chars = 0;
		for (const part of candidate.content) {
			if (!isRecord(part)) continue;
			if (part.type === "text" && typeof part.text === "string")
				chars += part.text.length;
			else if (part.type === "thinking" && typeof part.thinking === "string")
				chars += part.thinking.length;
			else if (part.type === "toolCall")
				chars +=
					String(part.name ?? "").length +
					JSON.stringify(part.arguments ?? {}).length;
		}
		return Math.ceil(chars / 4);
	}
	if (
		candidate.role === "compactionSummary" ||
		candidate.role === "branchSummary"
	)
		return Math.ceil(String(candidate.summary ?? "").length / 4);
	if (candidate.role === "bashExecution")
		return Math.ceil(
			(String(candidate.command ?? "").length +
				String(candidate.output ?? "").length) /
				4,
		);
	return Math.ceil(contentText(candidate.content).length / 4);
}

function isCompletedAssistant(message: AgentMessage): boolean {
	const candidate = message as unknown as Record<string, unknown>;
	return candidate.role === "assistant" && candidate.stopReason !== "pending";
}

function userTurnStarts(messages: readonly AgentMessage[]): number[] {
	const starts: number[] = [];
	for (const [index, message] of messages.entries()) {
		const role = (message as { role?: unknown }).role;
		if (
			role === "user" ||
			role === "custom" ||
			role === "bashExecution" ||
			role === "branchSummary" ||
			role === "compactionSummary"
		)
			starts.push(index);
	}
	return starts;
}

function turnStartFor(
	starts: readonly number[],
	index: number,
): number | undefined {
	for (let position = starts.length - 1; position >= 0; position--)
		if (starts[position] <= index) return starts[position];
	return undefined;
}

/** A later turn counts only after its assistant response is persisted. */
function hasNewerCompletedTurn(
	messages: readonly AgentMessage[],
	starts: readonly number[],
	index: number,
): boolean {
	const currentStart = turnStartFor(starts, index);
	if (currentStart === undefined) return false;
	for (const start of starts) {
		if (start <= currentStart) continue;
		const nextStart =
			starts.find((candidate) => candidate > start) ?? messages.length;
		if (messages.slice(start + 1, nextStart).some(isCompletedAssistant))
			return true;
	}
	return false;
}

function protectedTailIndices(messages: readonly AgentMessage[]): Set<number> {
	const protectedIndices = new Set<number>();
	let tokens = 0;
	for (let index = messages.length - 1; index >= 0; index--) {
		const messageTokenCount = messageTokens(messages[index]);
		// Do not let one old, oversized result silently extend the configured
		// evidence budget. The separately protected latest results still retain
		// current work and exact recent evidence.
		if (tokens + messageTokenCount > RESEARCH_PROTECTED_RECENT_TOKENS) break;
		protectedIndices.add(index);
		tokens += messageTokenCount;
	}
	return protectedIndices;
}

function canonicalUrl(value: unknown): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	// Markdown prose commonly puts sentence punctuation immediately after a
	// citation URL. It is not part of the URL in that representation.
	const trimmed = value.trim().replace(/[.,;:!?]+$/, "");
	try {
		const parsed = new URL(trimmed);
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

function compactValue(value: string): string {
	const bytes = Buffer.byteLength(value, "utf8");
	if (bytes <= 512) return value;
	let end = value.length;
	while (end > 0 && Buffer.byteLength(value.slice(0, end), "utf8") > 509) end--;
	return `${value.slice(0, end)}...`;
}

function targetFor(result: ToolResultMessage): string {
	const details = isRecord(result.details) ? result.details : {};
	if (result.toolName === "websearch") {
		const query =
			typeof details.query === "string"
				? details.query
				: (result as unknown as { input?: { query?: unknown } }).input?.query;
		return compactValue(typeof query === "string" ? query : "(unknown query)");
	}

	return compactValue(
		canonicalUrl(details.finalUrl) ??
			canonicalUrl(details.url) ??
			canonicalUrl(
				(result as unknown as { input?: { url?: unknown } }).input?.url,
			) ??
			"(unknown URL)",
	);
}

function citationUrls(text: string): string[] {
	const urls: string[] = [];
	// Markdown links and autolinks are explicit citation forms. A bounded raw
	// URL form covers ordinary source lists without treating arbitrary details
	// or tool output as citations.
	for (const match of text.matchAll(
		/\[[^\]]*\]\(\s*(?:<([^>]+)>|(https?:\/\/[^\s)]+))(?:\s+["'][^)]*["'])?\s*\)/gi,
	))
		urls.push(match[1] ?? match[2]);
	for (const match of text.matchAll(/<((?:https?):\/\/[^>\s]+)>/gi))
		urls.push(match[1]);
	for (const match of text.matchAll(/(?:^|\s)(https?:\/\/[^\s<>()[\]{}"']+)/gi))
		urls.push(match[1]);
	return urls;
}

function referencedUrls(messages: readonly AgentMessage[]): Set<string> {
	const urls = messages
		.filter((message) => (message as { role?: unknown }).role === "assistant")
		.flatMap((message) =>
			citationUrls(
				contentText((message as unknown as { content?: unknown }).content),
			),
		);
	return new Set(
		urls.map(canonicalUrl).filter((url): url is string => Boolean(url)),
	);
}

function citationProtected(
	messages: readonly AgentMessage[],
	result: ToolResultMessage,
	cited: ReadonlySet<string>,
): boolean {
	if (result.toolName !== "webfetch") return false;
	const details = isRecord(result.details) ? result.details : {};
	const url =
		canonicalUrl(details.finalUrl) ??
		canonicalUrl(details.url) ??
		canonicalUrl(
			(result as unknown as { input?: { url?: unknown } }).input?.url,
		);
	return Boolean(url && cited.has(url));
}

function staleRecord(result: ToolResultMessage): TextContent {
	const status = result.isError ? "error" : "success";
	const evidenceRef = `${result.toolName}:${result.toolCallId}`;
	return {
		type: "text",
		text: `[Stale Research evidence masked: kind=${result.toolName}; target=${targetFor(result)}; status=${status}; evidence-ref=${evidenceRef}]`,
	};
}

function isWebResult(message: AgentMessage): message is ToolResultMessage {
	const candidate = message as unknown as Record<string, unknown>;
	return (
		candidate.role === "toolResult" &&
		(candidate.toolName === "websearch" || candidate.toolName === "webfetch") &&
		typeof candidate.toolCallId === "string"
	);
}

/**
 * Replace only stale successful web observations in the deep-copied context.
 * Session entries are never changed and Pi compaction messages are left intact.
 */
export function maskStaleResearchEvidence(messages: readonly AgentMessage[]): {
	messages: AgentMessage[];
	telemetry: ResearchContextTelemetry;
} {
	const originalBytes = textBytes(messages);
	const starts = userTurnStarts(messages);
	const recent = protectedTailIndices(messages);
	const cited = referencedUrls(messages);
	const webIndices = messages
		.map((message, index) => (isWebResult(message) ? index : -1))
		.filter((index) => index >= 0);
	const mostRecent = new Set(
		webIndices.slice(-RESEARCH_PROTECTED_EVIDENCE_RESULTS),
	);
	let maskedResults = 0;
	const delivered = messages.map((message, index) => {
		// Assistant calls without a result and every non-web message, including
		// configured protected tools, remain structurally untouched.
		if (
			!isWebResult(message) ||
			(RESEARCH_PROTECTED_TOOLS as readonly string[]).includes(
				message.toolName,
			) ||
			message.isError ||
			recent.has(index) ||
			mostRecent.has(index) ||
			citationProtected(messages, message, cited) ||
			!hasNewerCompletedTurn(messages, starts, index)
		)
			return message;
		maskedResults++;
		// Tool details and input can contain the same unbounded raw evidence as
		// content. Provider context receives only this protocol-minimal envelope.
		return {
			role: "toolResult",
			toolCallId: message.toolCallId,
			toolName: message.toolName,
			content: [staleRecord(message)],
			...(message.isError === undefined ? {} : { isError: message.isError }),
		} as AgentMessage;
	});
	const deliveredBytes = textBytes(delivered);
	return {
		messages: delivered,
		telemetry: {
			originalBytes,
			deliveredBytes,
			originalTokenEstimate: Math.ceil(originalBytes / 4),
			deliveredTokenEstimate: Math.ceil(deliveredBytes / 4),
			maskedResults,
		},
	};
}

type ResearchContextAPI = Pick<ExtensionAPI, "on"> &
	Partial<Pick<ExtensionAPI, "appendEntry">>;

export function validUtf8Prefix(value: string, maxBytes: number): string {
	if (maxBytes <= 0 || !value) return "";
	let end = 0;
	let bytes = 0;
	while (end < value.length) {
		const first = value.charCodeAt(end);
		const isHighSurrogate = first >= 0xd800 && first <= 0xdbff;
		const isLowSurrogate = first >= 0xdc00 && first <= 0xdfff;
		if (isLowSurrogate) break;
		const width =
			isHighSurrogate &&
			end + 1 < value.length &&
			value.charCodeAt(end + 1) >= 0xdc00 &&
			value.charCodeAt(end + 1) <= 0xdfff
				? 2
				: isHighSurrogate
					? 0
					: 1;
		if (width === 0) break;
		const next = value.slice(end, end + width);
		const nextBytes = Buffer.byteLength(next, "utf8");
		if (bytes + nextBytes > maxBytes) break;
		bytes += nextBytes;
		end += width;
	}
	return value.slice(0, end);
}

function budgetConfiguration(
	ctx: ExtensionContext,
): ResearchWorkBudgetConfiguration | undefined {
	for (const entry of [...(ctx.sessionManager?.getEntries() ?? [])].reverse()) {
		if (
			entry.type === "custom" &&
			entry.customType === RESEARCH_WORK_BUDGET_ENTRY &&
			isResearchWorkBudgetConfiguration(entry.data)
		) {
			return entry.data;
		}
	}
	return undefined;
}

/** Race-safe per-process ledger; Pi can concurrently dispatch sibling tool calls. */
export class ResearchWorkLedger {
	private readonly reservations = new Map<string, WebTool>();
	private readonly reserved = { searchCalls: 0, fetchCalls: 0 };
	private readonly finalized = { searchCalls: 0, fetchCalls: 0 };
	private readonly consumed = {
		searchCalls: 0,
		fetchCalls: 0,
		deliveredBytes: 0,
	};
	private readonly blocked = {
		searchCalls: 0,
		fetchCalls: 0,
		exhaustedBytes: 0,
	};
	private reservedNoticeBytes = 0;
	private truncatedBytes = 0;

	readonly configuration: ResearchWorkBudgetConfiguration;

	constructor(configuration: ResearchWorkBudgetConfiguration) {
		this.configuration = configuration;
	}

	reserve(toolCallId: string, toolName: string): { block?: string } {
		if (!(WEB_TOOLS as readonly string[]).includes(toolName)) return {};
		const tool = toolName as WebTool;
		const key = tool === "websearch" ? "searchCalls" : "fetchCalls";
		if (this.reservations.has(toolCallId)) return {};
		const noticeBytes = Buffer.byteLength(
			RESEARCH_BUDGET_TRUNCATION_NOTICE,
			"utf8",
		);
		if (
			this.configuration.configured.deliveredBytes -
				this.consumed.deliveredBytes -
				this.reservedNoticeBytes <
			noticeBytes
		) {
			this.blocked.exhaustedBytes++;
			return {
				block:
					"Research web-result byte budget is exhausted; no further web calls may run in this invocation.",
			};
		}
		if (this.reserved[key] >= this.configuration.configured[key]) {
			this.blocked[key]++;
			return {
				block: `Research ${tool} call budget is exhausted (${this.configuration.configured[key]}); no transport was started.`,
			};
		}
		this.reservations.set(toolCallId, tool);
		this.reservedNoticeBytes += noticeBytes;
		this.reserved[key]++;
		return {};
	}

	finalize(
		toolCallId: string,
		content: Array<{ type: string; text?: string }>,
		isError: boolean,
	): { content?: Array<{ type: string; text?: string }> } {
		const tool = this.reservations.get(toolCallId);
		if (!tool) return {};
		this.reservations.delete(toolCallId);
		const noticeBytes = Buffer.byteLength(
			RESEARCH_BUDGET_TRUNCATION_NOTICE,
			"utf8",
		);
		this.reservedNoticeBytes -= noticeBytes;
		const key = tool === "websearch" ? "searchCalls" : "fetchCalls";
		this.finalized[key]++;
		this.consumed[key]++;
		if (isError) return {};
		const originalBytes = content.reduce(
			(total, part) =>
				total +
				(part.type === "text" && typeof part.text === "string"
					? Buffer.byteLength(part.text, "utf8")
					: 0),
			0,
		);
		const remaining =
			this.configuration.configured.deliveredBytes -
			this.consumed.deliveredBytes -
			this.reservedNoticeBytes;
		if (originalBytes <= remaining) {
			this.consumed.deliveredBytes += originalBytes;
			return {};
		}
		let allowance = remaining - noticeBytes;
		const trimmed = content.map((part) => {
			if (part.type !== "text" || typeof part.text !== "string") return part;
			const text = validUtf8Prefix(part.text, allowance);
			allowance -= Buffer.byteLength(text, "utf8");
			return { ...part, text };
		});
		const retainedEvidenceBytes = Math.max(
			0,
			remaining - noticeBytes - allowance,
		);
		this.consumed.deliveredBytes += retainedEvidenceBytes + noticeBytes;
		this.truncatedBytes += originalBytes - retainedEvidenceBytes;
		return {
			content: [
				...trimmed,
				{ type: "text", text: RESEARCH_BUDGET_TRUNCATION_NOTICE },
			],
		};
	}

	finalizePending(): void {
		for (const [toolCallId, tool] of this.reservations) {
			this.reservations.delete(toolCallId);
			this.reservedNoticeBytes -= Buffer.byteLength(
				RESEARCH_BUDGET_TRUNCATION_NOTICE,
				"utf8",
			);
			this.finalized[tool === "websearch" ? "searchCalls" : "fetchCalls"]++;
		}
	}

	telemetry(): ResearchWorkBudgetTelemetry {
		const configured = {
			...this.configuration,
			configured: { ...this.configuration.configured },
		};
		return {
			...configured,
			reserved: { ...this.reserved },
			finalized: { ...this.finalized },
			consumed: { ...this.consumed },
			truncatedBytes: this.truncatedBytes,
			blocked: { ...this.blocked },
			exhausted: {
				searchCalls:
					this.reserved.searchCalls >= configured.configured.searchCalls,
				fetchCalls:
					this.reserved.fetchCalls >= configured.configured.fetchCalls,
				deliveredBytes:
					configured.configured.deliveredBytes - this.consumed.deliveredBytes <
					Buffer.byteLength(RESEARCH_BUDGET_TRUNCATION_NOTICE, "utf8"),
			},
			activeReservations: this.reservations.size,
		};
	}
}

/** Register child-only masking and shared web work budgets. */
export function registerResearchContext(
	pi: ResearchContextAPI,
	options: ResearchContextOptions = {},
): ResearchContextTracker {
	const environment = options.environment ?? process.env;
	const tracker = options.tracker ?? new ResearchContextTracker();
	if (!environment[RESEARCH_CHILD_ENV]) return tracker;
	const ledgers = new Map<string, ResearchWorkLedger>();
	const trusted = (ctx: ExtensionContext) =>
		Boolean(
			ctx?.sessionManager &&
				isTrustedResearchChildSession(
					ctx.sessionManager,
					environment[RESEARCH_CHILD_ENV],
					environment[RESEARCH_PARENT_ENV],
				),
		);
	const ledgerFor = (ctx: ExtensionContext) => {
		if (!trusted(ctx)) return undefined;
		const configuration = budgetConfiguration(ctx);
		if (!configuration) return undefined;
		let ledger = ledgers.get(configuration.invocationId);
		if (!ledger) {
			ledger = new ResearchWorkLedger(configuration);
			ledgers.set(configuration.invocationId, ledger);
		}
		return ledger;
	};
	const audit = (ledger: ResearchWorkLedger | undefined) =>
		ledger && pi.appendEntry?.(RESEARCH_WORK_BUDGET_ENTRY, ledger.telemetry());
	pi.on("context", (event, ctx: ExtensionContext) => {
		if (!trusted(ctx)) return undefined;
		const masked = maskStaleResearchEvidence(event.messages);
		tracker.record(masked.telemetry);
		pi.appendEntry?.(RESEARCH_CONTEXT_ENTRY, masked.telemetry);
		if (masked.telemetry.maskedResults === 0) return undefined;
		event.messages.splice(0, event.messages.length, ...masked.messages);
		return { messages: masked.messages };
	});
	pi.on("tool_call", (event, ctx: ExtensionContext) => {
		const ledger = ledgerFor(ctx);
		if (!ledger || !(WEB_TOOLS as readonly string[]).includes(event.toolName))
			return undefined;
		const reservation = ledger.reserve(event.toolCallId, event.toolName);
		audit(ledger);
		return reservation.block
			? { block: true, terminate: true, reason: reservation.block }
			: undefined;
	});
	pi.on("tool_result", (event, ctx: ExtensionContext) => {
		const ledger = ledgerFor(ctx);
		if (!ledger || !(WEB_TOOLS as readonly string[]).includes(event.toolName))
			return undefined;
		const result = ledger.finalize(
			event.toolCallId,
			event.content as Array<{ type: string; text?: string }>,
			event.isError,
		);
		if (event.toolName === "webfetch") {
			const evidence = recordResearchFetchEvidence({
				...event,
				content: result.content ?? event.content,
			});
			if (evidence) pi.appendEntry?.(RESEARCH_FETCH_EVIDENCE_ENTRY, evidence);
		}
		audit(ledger);
		return result;
	});
	pi.on("agent_end", (_event, ctx: ExtensionContext) => {
		const ledger = ledgerFor(ctx);
		ledger?.finalizePending();
		audit(ledger);
	});
	return tracker;
}
