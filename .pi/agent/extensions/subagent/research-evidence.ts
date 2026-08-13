import type { NormalizedResearchInput } from "./research.ts";

export const RESEARCH_FETCH_EVIDENCE_ENTRY = "research-fetch-evidence";
export const RESEARCH_FETCH_EVIDENCE_VERSION = 1;
export const RESEARCH_SUPPORT_EXCERPT_MAX_BYTES = 4 * 1024;

export type FetchOutcome = "success" | "limited" | "failed" | "inaccessible";

export interface ResearchFetchEvidence {
	version: typeof RESEARCH_FETCH_EVIDENCE_VERSION;
	toolCallId: string;
	requestedUrl: string;
	finalUrl?: string;
	status: number | "failed" | "inaccessible" | "unknown";
	outcome: FetchOutcome;
	retrievedAt: string;
	/** Exact UTF-8 prefixes of delivered text, retained outside model context. */
	supportExcerpts: string[];
}

export interface ResearchValidation {
	valid: boolean;
	sections: string[];
	citedUrls: string[];
	unsupportedClaims: string[];
	provenanceFailures: string[];
	structureFailures: string[];
	mechanicalLimits: string[];
}

export interface ResearchEvidenceDetails {
	fetches: ResearchFetchEvidence[];
	validation: ResearchValidation;
}

type TextContent = { type: string; text?: string };
type ToolResultLike = {
	toolCallId: unknown;
	toolName: unknown;
	input: unknown;
	content: unknown;
	details: unknown;
	isError: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function canonicalWebUrl(value: unknown): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	try {
		const url = new URL(value.trim().replace(/[.,;:!?]+$/, ""));
		return url.protocol === "http:" || url.protocol === "https:"
			? url.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

function validUtf8Prefix(value: string, maxBytes: number): string {
	let end = 0;
	let bytes = 0;
	while (end < value.length) {
		const point = value.codePointAt(end);
		if (point === undefined) break;
		const part = String.fromCodePoint(point);
		const next = Buffer.byteLength(part, "utf8");
		if (bytes + next > maxBytes) break;
		bytes += next;
		end += part.length;
	}
	return value.slice(0, end);
}

function textContent(content: unknown): string[] {
	if (!Array.isArray(content)) return [];
	return content.flatMap((part) =>
		isRecord(part) && part.type === "text" && typeof part.text === "string"
			? [part.text]
			: [],
	);
}

function inaccessible(text: string, status?: number): boolean {
	return (
		status === 401 ||
		status === 403 ||
		status === 404 ||
		status === 405 ||
		status === 410 ||
		status === 451 ||
		/HTTP (?:401|403|404|405|410|451)\b|unsupported content type|challenge/i.test(
			text,
		)
	);
}

function isSuccessfulStatus(status: unknown): status is number {
	return (
		typeof status === "number" &&
		Number.isInteger(status) &&
		status >= 200 &&
		status < 300
	);
}

/** Build provenance only from the completed webfetch event, never model text. */
export function recordResearchFetchEvidence(
	event: ToolResultLike,
	now = new Date(),
): ResearchFetchEvidence | undefined {
	if (event.toolName !== "webfetch" || typeof event.toolCallId !== "string")
		return undefined;
	const input = isRecord(event.input) ? event.input : {};
	const details = isRecord(event.details) ? event.details : {};
	const requestedUrl = canonicalWebUrl(input.url ?? details.url);
	if (!requestedUrl) return undefined;
	const finalUrl = canonicalWebUrl(details.finalUrl);
	const content = textContent(event.content);
	const joined = content.join("\n");
	const status = typeof details.status === "number" && Number.isInteger(details.status)
		? details.status
		: event.isError
			? inaccessible(joined) ? "inaccessible" : "failed"
			: "unknown";
	const budgetLimited = joined.includes(
		"[Research web evidence truncated: budget exhausted. Further web calls are blocked.]",
	);
	const outcome: FetchOutcome = event.isError
		? inaccessible(joined, typeof status === "number" ? status : undefined)
			? "inaccessible"
			: "failed"
		: budgetLimited || !finalUrl || status === "unknown"
			? "limited"
			: isSuccessfulStatus(status)
				? "success"
				: inaccessible(joined, typeof status === "number" ? status : undefined)
					? "inaccessible"
					: "failed";
	return {
		version: RESEARCH_FETCH_EVIDENCE_VERSION,
		toolCallId: event.toolCallId,
		requestedUrl,
		...(finalUrl ? { finalUrl } : {}),
		status,
		outcome,
		retrievedAt: now.toISOString(),
		supportExcerpts: content
			.map((text) => validUtf8Prefix(text, RESEARCH_SUPPORT_EXCERPT_MAX_BYTES))
			.filter(Boolean),
	};
}

export function evidenceFromChildMessages(
	messages: readonly unknown[],
): ResearchFetchEvidence[] {
	return messages.flatMap((message) => {
		if (!isRecord(message)) return [];
		const evidence = recordResearchFetchEvidence(message as ToolResultLike);
		return evidence ? [evidence] : [];
	});
}

export function isResearchFetchEvidence(value: unknown): value is ResearchFetchEvidence {
	if (!isRecord(value)) return false;
	const status = value.status;
	return (
		value.version === RESEARCH_FETCH_EVIDENCE_VERSION &&
		typeof value.toolCallId === "string" &&
		Boolean(canonicalWebUrl(value.requestedUrl)) &&
		(value.finalUrl === undefined || Boolean(canonicalWebUrl(value.finalUrl))) &&
		(typeof status === "number" || status === "failed" || status === "inaccessible" || status === "unknown") &&
		(typeof status !== "number" || Number.isInteger(status)) &&
		(value.outcome === "success" ||
			value.outcome === "limited" ||
			value.outcome === "failed" ||
			value.outcome === "inaccessible") &&
		(value.outcome !== "success" ||
			(isSuccessfulStatus(status) && Boolean(canonicalWebUrl(value.finalUrl)))) &&
		typeof value.retrievedAt === "string" &&
		!Number.isNaN(Date.parse(value.retrievedAt)) &&
		Array.isArray(value.supportExcerpts) &&
		value.supportExcerpts.every((excerpt) => typeof excerpt === "string")
	);
}

function sectionRanges(output: string): {
	sections: Map<string, { start: number; end: number }>;
	failures: string[];
} {
	const lines = output.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
	const required = ["Answer", "Findings", "Conflicts and limits", "Sources"];
	const found: Array<{ name: string; index: number }> = [];
	for (const [index, line] of lines.entries()) {
		const match = /^## (Answer|Findings|Conflicts and limits|Sources)[ \t]*$/.exec(line);
		if (match) found.push({ name: match[1], index });
	}
	const failures: string[] = [];
	if (lines.findIndex((line) => line.trim()) !== found[0]?.index || found[0]?.name !== "Answer")
		failures.push("Response must begin with ## Answer.");
	if (found.length !== required.length || found.some((item, index) => item.name !== required[index]))
		failures.push("Response must contain ## Answer, ## Findings, ## Conflicts and limits, and ## Sources exactly once in that order.");
	const sections = new Map<string, { start: number; end: number }>();
	for (const [index, item] of found.entries())
		sections.set(item.name, { start: item.index + 1, end: found[index + 1]?.index ?? lines.length });
	return { sections, failures };
}

function urlsIn(text: string): { urls: string[]; malformed: string[] } {
	const urls: string[] = [];
	const malformed: string[] = [];
	for (const match of text.matchAll(/\[[^\]]*\]\(\s*([^\s)]+)[^)]*\)/g)) {
		const raw = match[1].replace(/^<|>$/g, "");
		const url = canonicalWebUrl(raw);
		if (raw.startsWith("http:") || raw.startsWith("https:")) {
			if (url) urls.push(url);
			else malformed.push(raw);
		}
	}
	for (const match of text.matchAll(/\[[^\]]*\]\([^)]*(?:https?:\/\/)[^)]*$/gm))
		malformed.push(match[0]);
	for (const match of text.matchAll(/<((?:https?):\/\/[^>\s]+)>/gi)) {
		const url = canonicalWebUrl(match[1]);
		if (url) urls.push(url);
		else malformed.push(match[1]);
	}
	for (const match of text.matchAll(/(?:^|\s)(https?:\/\/[^\s<>()[\]{}"']+)/gi)) {
		const url = canonicalWebUrl(match[1]);
		if (url) urls.push(url);
		else malformed.push(match[1]);
	}
	return { urls: [...new Set(urls)], malformed };
}

function hasLocalCitation(value: string): boolean {
	return /(?:^|[\s`(])(?:[\w.@/~-]+\.[\w-]+):\d+(?:-\d+)?\b/.test(value);
}

function limitedLabel(value: string): boolean {
	return /\blimited\b|\bsearch[ -]excerpt\b|\binaccessible\b|\bfailed fetch\b|\bunfetched\b/i.test(value);
}

function fullReviewClaim(value: string): boolean {
	return /\b(?:inspected|full[- ]source|read the source)\b|(?<!not )\breviewed\b/i.test(value);
}

function generatedAnswerNotice(value: string): boolean {
	return /^(?:Research validation failed\.|Research execution failed\.|Research response exceeded output limits\.)/i.test(
		value.trim(),
	);
}

function answerParagraphs(lines: readonly string[]): Array<{ line: number; text: string }> {
	const paragraphs: Array<{ line: number; text: string }> = [];
	let start = 0;
	let current: string[] = [];
	const flush = () => {
		const text = current
			.filter((line) => !/^Research ID: r_[0-9a-f-]+$/i.test(line.trim()))
			.join("\n")
			.trim();
		if (text) paragraphs.push({ line: start, text });
		current = [];
	};
	for (const [index, line] of lines.entries()) {
		if (!line.trim()) {
			flush();
			start = index + 2;
			continue;
		}
		if (current.length === 0) start = index + 1;
		current.push(line);
	}
	flush();
	return paragraphs;
}

function boundedFallback(researchId?: string): string {
	return [
		"## Answer",
		...(researchId ? [`Research ID: ${researchId}`] : []),
		"Research response exceeded output limits. Full validated response remains in tool details.",
		"",
		"## Findings",
		"- No material findings.",
		"",
		"## Conflicts and limits",
		"- Response was truncated; inspect tool details for the complete validated response.",
		"",
		"## Sources",
		"- See the complete validated response in tool details.",
	].join("\n");
}

/**
 * Never head-truncate a validated response: its trailing required headings are
 * part of the contract. The full response remains in private details.
 */
export function boundStructuredResearchOutput(
	output: string,
	limits: { maxLines: number; maxBytes: number },
): string {
	if (
		Buffer.byteLength(output, "utf8") <= limits.maxBytes &&
		output.split("\n").length <= limits.maxLines
	)
		return output;
	const researchId = /^Research ID: (r_[0-9a-f-]+)$/m.exec(output)?.[1];
	const fallback = boundedFallback(researchId);
	if (
		Buffer.byteLength(fallback, "utf8") > limits.maxBytes ||
		fallback.split("\n").length > limits.maxLines
	)
		throw new Error("Research output limits are too small for the required response structure.");
	return fallback;
}

/**
 * This is deliberately syntactic: it proves heading order, URL provenance,
 * and citations on Answer paragraphs and Findings bullets. It cannot prove semantic entailment.
 */
export function validateResearchOutput(
	output: string,
	fetches: readonly ResearchFetchEvidence[],
	_input?: NormalizedResearchInput,
): ResearchValidation {
	const { sections, failures: structureFailures } = sectionRanges(output);
	const allUrls = urlsIn(output);
	structureFailures.push(
		...allUrls.malformed.map((url) => `Malformed Markdown URL: ${url}.`),
	);
	const lines = output.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
	const sectionForLine = (line: number): string | undefined =>
		[...sections.entries()].find(([, range]) => line >= range.start && line < range.end)?.[0];
	const provenanceFailures: string[] = [];
	for (const url of allUrls.urls) {
		const matches = fetches.filter((fetch) =>
			fetch.requestedUrl === url || fetch.finalUrl === url,
		);
		if (
			matches.some(
				(fetch) =>
					fetch.outcome === "success" &&
					isSuccessfulStatus(fetch.status) &&
					Boolean(fetch.finalUrl),
			)
		)
			continue;
		const occurrences = lines.flatMap((line, index) =>
			urlsIn(line).urls.includes(url)
				? [{ line, section: sectionForLine(index) }]
				: [],
		);
		const confinedAndLabeled =
			occurrences.length > 0 &&
			occurrences.every(
				(occurrence) =>
					occurrence.section === "Conflicts and limits" &&
					limitedLabel(occurrence.line) &&
					!fullReviewClaim(occurrence.line),
			);
		if (!confinedAndLabeled) {
			const state = matches.at(-1)?.outcome ?? "search-only or unfetched";
			provenanceFailures.push(
				`${url} is ${state}; place it only in Conflicts and limits with a limited label and do not represent it as reviewed.`,
			);
		}
	}
	const unsupportedClaims: string[] = [];
	const answer = sections.get("Answer");
	if (answer) {
		for (const paragraph of answerParagraphs(lines.slice(answer.start, answer.end))) {
			if (generatedAnswerNotice(paragraph.text)) continue;
			const urls = urlsIn(paragraph.text).urls;
			if (urls.length === 0 && !hasLocalCitation(paragraph.text))
				unsupportedClaims.push(`Answer line ${answer.start + paragraph.line} has no deterministic citation.`);
		}
	}
	const findings = sections.get("Findings");
	if (findings) {
		for (const [index, line] of lines.slice(findings.start, findings.end).entries()) {
			const trimmed = line.trim();
			if (!trimmed || /^- (?:None\.|No material findings\.|No web claims\.)$/i.test(trimmed)) continue;
			if (!trimmed.startsWith("- ")) {
				unsupportedClaims.push(`Findings line ${findings.start + index + 1} must be an atomic bullet with a citation.`);
				continue;
			}
			const urls = urlsIn(trimmed).urls;
			if (urls.length === 0 && !hasLocalCitation(trimmed))
				unsupportedClaims.push(`Findings line ${findings.start + index + 1} has no deterministic citation.`);
		}
	}
	return {
		valid:
			structureFailures.length === 0 &&
			provenanceFailures.length === 0 &&
			unsupportedClaims.length === 0,
		sections: [...sections.keys()],
		citedUrls: allUrls.urls,
		unsupportedClaims,
		provenanceFailures,
		structureFailures,
		mechanicalLimits: [
			"Validation checks required headings, successful 2xx webfetch provenance, limited-URL placement, and citations on Answer paragraphs and Findings bullets.",
			"It does not prove semantic entailment, source quality, contradiction handling, or completeness beyond the cited Answer and Findings claim units.",
		],
	};
}

export function researchValidationFailure(
	_validation: ResearchValidation,
	researchId?: string,
): string {
	return [
		"## Answer",
		...(researchId ? [`Research ID: ${researchId}`] : []),
		"Research validation failed. Correct the required structure or evidence citations, then resume this Research ID. Full diagnostics remain in tool details.",
		"",
		"## Findings",
		"- No material findings.",
		"",
		"## Conflicts and limits",
		"- The returned response did not satisfy structural or evidence checks; inspect tool details for complete diagnostics.",
		"",
		"## Sources",
		"- None accepted because the returned response failed validation.",
	].join("\n");
}

/** Return a safe model-visible failure while full child diagnostics remain private. */
export function researchExecutionFailure(
	researchId?: string,
	diagnostic?: string,
): string {
	const safeDiagnostic = diagnostic
		?.replace(/\s+/g, " ")
		.trim()
		.slice(0, 512);
	return [
		"## Answer",
		...(researchId ? [`Research ID: ${researchId}`] : []),
		`Research execution failed.${safeDiagnostic ? ` ${safeDiagnostic}` : " Inspect tool details and resume this Research ID."}`,
		"",
		"## Findings",
		"- No material findings.",
		"",
		"## Conflicts and limits",
		"- The child did not return a usable final response; full diagnostics remain in tool details.",
		"",
		"## Sources",
		"- None.",
	].join("\n");
}

export function addResearchIdToAnswer(output: string, researchId?: string): string {
	if (!researchId) return output;
	const lines = output.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
	const answer = lines.findIndex((line) => /^## Answer[ \t]*$/.test(line));
	if (answer < 0) return output;
	const existing = lines.findIndex(
		(line, index) => index > answer && /^Research ID: /.test(line),
	);
	if (existing >= 0) lines.splice(existing, 1);
	lines.splice(answer + 1, 0, `Research ID: ${researchId}`);
	return lines.join("\n");
}
