import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { RESEARCH_CONTEXT_ENTRY, type ResearchContextTelemetry } from "./research-context-audit.ts";
import { RESEARCH_CHILD_ENV, isTrustedResearchChildSession } from "./research-session.ts";

/**
 * Pi keeps 20k tokens after normal compaction. Keeping 12k here leaves enough
 * recent evidence for iterative work while allowing old web observations to
 * stop consuming every later provider request.
 */
export const RESEARCH_PROTECTED_RECENT_TOKENS = 12_000;
export const RESEARCH_PROTECTED_EVIDENCE_RESULTS = 3;
export const RESEARCH_PROTECTED_TOOLS = ["read", "grep", "find", "ls"] as const;

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
	return content.filter((part): part is TextContent => isRecord(part) && part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
}

function messageTokens(message: AgentMessage): number {
	const candidate = message as unknown as Record<string, unknown>;
	if (candidate.role === "assistant" && Array.isArray(candidate.content)) {
		let chars = 0;
		for (const part of candidate.content) {
			if (!isRecord(part)) continue;
			if (part.type === "text" && typeof part.text === "string") chars += part.text.length;
			else if (part.type === "thinking" && typeof part.thinking === "string") chars += part.thinking.length;
			else if (part.type === "toolCall") chars += String(part.name ?? "").length + JSON.stringify(part.arguments ?? {}).length;
		}
		return Math.ceil(chars / 4);
	}
	if (candidate.role === "compactionSummary" || candidate.role === "branchSummary") return Math.ceil(String(candidate.summary ?? "").length / 4);
	if (candidate.role === "bashExecution") return Math.ceil((String(candidate.command ?? "").length + String(candidate.output ?? "").length) / 4);
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
		if (role === "user" || role === "custom" || role === "bashExecution" || role === "branchSummary" || role === "compactionSummary") starts.push(index);
	}
	return starts;
}

function turnStartFor(starts: readonly number[], index: number): number | undefined {
	for (let position = starts.length - 1; position >= 0; position--) if (starts[position] <= index) return starts[position];
	return undefined;
}

/** A later turn counts only after its assistant response is persisted. */
function hasNewerCompletedTurn(messages: readonly AgentMessage[], starts: readonly number[], index: number): boolean {
	const currentStart = turnStartFor(starts, index);
	if (currentStart === undefined) return false;
	for (const start of starts) {
		if (start <= currentStart) continue;
		const nextStart = starts.find((candidate) => candidate > start) ?? messages.length;
		if (messages.slice(start + 1, nextStart).some(isCompletedAssistant)) return true;
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
		return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
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
		const query = typeof details.query === "string"
			? details.query
			: (result as unknown as { input?: { query?: unknown } }).input?.query;
		return compactValue(typeof query === "string" ? query : "(unknown query)");
	}

	return compactValue(canonicalUrl(details.finalUrl) ?? canonicalUrl(details.url) ?? canonicalUrl((result as unknown as { input?: { url?: unknown } }).input?.url) ?? "(unknown URL)");
}

function citationUrls(text: string): string[] {
	const urls: string[] = [];
	// Markdown links and autolinks are explicit citation forms. A bounded raw
	// URL form covers ordinary source lists without treating arbitrary details
	// or tool output as citations.
	for (const match of text.matchAll(/\[[^\]]*\]\(\s*(?:<([^>]+)>|(https?:\/\/[^\s)]+))(?:\s+["'][^)]*["'])?\s*\)/gi)) urls.push(match[1] ?? match[2]);
	for (const match of text.matchAll(/<((?:https?):\/\/[^>\s]+)>/gi)) urls.push(match[1]);
	for (const match of text.matchAll(/(?:^|\s)(https?:\/\/[^\s<>()\[\]{}"']+)/gi)) urls.push(match[1]);
	return urls;
}

function referencedUrls(messages: readonly AgentMessage[]): Set<string> {
	const urls = messages
		.filter((message) => (message as { role?: unknown }).role === "assistant")
		.flatMap((message) => citationUrls(contentText((message as unknown as { content?: unknown }).content)));
	return new Set(urls.map(canonicalUrl).filter((url): url is string => Boolean(url)));
}

function citationProtected(messages: readonly AgentMessage[], result: ToolResultMessage, cited: ReadonlySet<string>): boolean {
	if (result.toolName !== "webfetch") return false;
	const details = isRecord(result.details) ? result.details : {};
	const url = canonicalUrl(details.finalUrl) ?? canonicalUrl(details.url) ?? canonicalUrl((result as unknown as { input?: { url?: unknown } }).input?.url);
	return Boolean(url && cited.has(url));
}

function staleRecord(result: ToolResultMessage): TextContent {
	const status = result.isError ? "error" : "success";
	const evidenceRef = `${result.toolName}:${result.toolCallId}`;
	return { type: "text", text: `[Stale Research evidence masked: kind=${result.toolName}; target=${targetFor(result)}; status=${status}; evidence-ref=${evidenceRef}]` };
}

function isWebResult(message: AgentMessage): message is ToolResultMessage {
	const candidate = message as unknown as Record<string, unknown>;
	return candidate.role === "toolResult" && (candidate.toolName === "websearch" || candidate.toolName === "webfetch") && typeof candidate.toolCallId === "string";
}

/**
 * Replace only stale successful web observations in the deep-copied context.
 * Session entries are never changed and Pi compaction messages are left intact.
 */
export function maskStaleResearchEvidence(messages: readonly AgentMessage[]): { messages: AgentMessage[]; telemetry: ResearchContextTelemetry } {
	const originalBytes = textBytes(messages);
	const starts = userTurnStarts(messages);
	const recent = protectedTailIndices(messages);
	const cited = referencedUrls(messages);
	const webIndices = messages.map((message, index) => isWebResult(message) ? index : -1).filter((index) => index >= 0);
	const mostRecent = new Set(webIndices.slice(-RESEARCH_PROTECTED_EVIDENCE_RESULTS));
	let maskedResults = 0;
	const delivered = messages.map((message, index) => {
		// Assistant calls without a result and every non-web message, including
		// configured protected tools, remain structurally untouched.
		if (!isWebResult(message) || (RESEARCH_PROTECTED_TOOLS as readonly string[]).includes(message.toolName) || message.isError || recent.has(index) || mostRecent.has(index) || citationProtected(messages, message, cited) || !hasNewerCompletedTurn(messages, starts, index)) return message;
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

/** Register a no-op parent hook; both the spawn marker and child lineage must validate. */
type ResearchContextAPI = Pick<ExtensionAPI, "on"> & Partial<Pick<ExtensionAPI, "appendEntry">>;

export function registerResearchContext(pi: ResearchContextAPI, options: ResearchContextOptions = {}): ResearchContextTracker {
	const environment = options.environment ?? process.env;
	const tracker = options.tracker ?? new ResearchContextTracker();
	// Do not even register in parents or generic children. A supplied marker is
	// still only a hint; the handler validates the active session below.
	if (!environment[RESEARCH_CHILD_ENV]) return tracker;
	pi.on("context", (event, ctx: ExtensionContext) => {
		const childSessionId = environment[RESEARCH_CHILD_ENV];
		if (!ctx?.sessionManager || !isTrustedResearchChildSession(ctx.sessionManager, childSessionId)) return undefined;
		const masked = maskStaleResearchEvidence(event.messages);
		tracker.record(masked.telemetry);
		// Custom entries stay out of Pi model context and survive this subprocess
		// for child audit and parent-side Research details.
		pi.appendEntry?.(RESEARCH_CONTEXT_ENTRY, masked.telemetry);
		if (masked.telemetry.maskedResults === 0) return undefined;
		event.messages.splice(0, event.messages.length, ...masked.messages);
		return { messages: masked.messages };
	});
	return tracker;
}
