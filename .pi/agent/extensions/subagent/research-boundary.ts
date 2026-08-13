import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Api, ApiStreamOptions, Context, Model, Provider, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { RESEARCH_MAX_BYTES, RESEARCH_MAX_LINES } from "./research.ts";

export const RESEARCH_ISOLATION_ENTRY = "research-isolation";
export const RESEARCH_ISOLATION_ERROR = "Research isolation failure: private child evidence was removed before the provider request. Inspect Research details.";

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; contextTokens: number; turns: number };
type SafeContent = Array<{ type: "text"; text: string }>;
type ProviderApi = "openai-responses" | "openai-codex-responses" | "azure-openai-responses" | "anthropic-messages" | "openai-completions" | string | undefined;

export interface ResearchIsolationTelemetry {
	toolCallId: string;
	modelVisibleBytes: number;
	modelVisibleTokenEstimate: number;
	providerPayloadBytes?: number;
	providerPayloadTokenEstimate?: number;
	attemptedProviderPayloadBytes?: number;
	leakDetected: boolean;
	providerReplacement?: boolean;
	/** The request was aborted before an unguarded replacement provider could transport it. */
	providerGuardReplacement?: boolean;
	childUsage: Usage;
	totalUsage: Usage;
}

interface PrivateRun {
	toolCallId: string;
	safeContent: SafeContent;
	privateFragments: string[];
	privateOpaqueIds: string[];
	privateStructures: string[];
	childUsage: Usage;
	totalUsage: Usage;
	telemetry?: ResearchIsolationTelemetry;
	contextPresented: boolean;
	contextLeakDetected: boolean;
	trustedParentStrings: Set<string>;
	trustedParentStructures: Set<string>;
}

interface ResearchToolResult {
	content: Array<{ type: string; text?: string }>;
	details?: { usage?: unknown; results?: Array<{ messages?: unknown[]; usage?: unknown }> };
}

type BoundaryAPI = Pick<ExtensionAPI, "on" | "registerProvider"> & { appendEntry?: ExtensionAPI["appendEntry"] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function serializedBytes(value: unknown): number {
	return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
}

function usage(value: unknown): Usage {
	const candidate = isRecord(value) ? value : {};
	const number = (key: string) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]) ? candidate[key] as number : 0;
	return { input: number("input"), output: number("output"), cacheRead: number("cacheRead"), cacheWrite: number("cacheWrite"), cost: number("cost"), contextTokens: number("contextTokens"), turns: number("turns") };
}

function isBoundedText(text: string): boolean {
	return Buffer.byteLength(text, "utf8") <= RESEARCH_MAX_BYTES && text.split("\n").length <= RESEARCH_MAX_LINES;
}

function safeContent(value: unknown): SafeContent | undefined {
	if (!Array.isArray(value) || value.length !== 1) return undefined;
	const part = value[0];
	if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string" || !isBoundedText(part.text)) return undefined;
	return [{ type: "text", text: part.text }];
}

function sameContent(left: SafeContent | undefined, right: SafeContent | undefined): boolean {
	return Boolean(left && right && left[0].text === right[0].text);
}

const STRUCTURAL_VALUE_KEYS = new Set(["type", "role", "toolName", "name"]);
const OPAQUE_ID_KEYS = new Set(["id", "toolCallId", "call_id", "tool_use_id"]);
// These are the only child final-message values that may also occur in a parent
// request. Keep this path-specific: generic IDs and signatures are private.
const FINAL_ASSISTANT_METADATA_KEYS = new Set(["model", "provider", "responseId", "response_id"]);
const FINAL_REASONING_METADATA_KEYS = new Set(["encrypted_content"]);
const FINAL_THINKING_METADATA_KEYS = new Set(["thinkingSignature", "encrypted_content"]);

/** A deterministic fingerprint preserves non-string private values without scalar taint. */
function fingerprint(value: unknown): string | undefined {
	if (value === null) return "null";
	if (typeof value === "boolean") return `boolean:${value}`;
	if (typeof value === "number") return Number.isFinite(value) ? `number:${value}` : undefined;
	if (typeof value === "string") return `string:${JSON.stringify(value)}`;
	if (Array.isArray(value)) {
		const values = value.map(fingerprint);
		return values.some((item) => item === undefined) ? undefined : `array:[${values.join(",")}]`;
	}
	if (!isRecord(value)) return undefined;
	const entries = Object.keys(value).sort().map((key) => {
		const child = fingerprint(value[key]);
		return child === undefined ? undefined : `${JSON.stringify(key)}:${child}`;
	});
	return entries.some((entry) => entry === undefined) ? undefined : `object:{${entries.join(",")}}`;
}

function scalarFingerprint(value: string | null | boolean | number, key?: string): string | undefined {
	const encoded = fingerprint(value);
	return encoded === undefined || key === undefined ? undefined : `scalar:${JSON.stringify(key)}:${encoded}`;
}

function addStructures(value: unknown, structures: Set<string>): void {
	if ((!Array.isArray(value) && !isRecord(value)) || (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.keys(value).length === 0)) return;
	const encoded = fingerprint(value);
	if (encoded) structures.add(encoded);
	for (const child of Array.isArray(value) ? value : Object.values(value)) addStructures(child, structures);
}

/** Collect child-created private observations, never child field names or bare generic scalars. */
function addPrivateObservation(value: unknown, fragments: Set<string>, opaqueIds: Set<string>, structures: Set<string>, boundedSynthesis: string, key?: string, keyedScalars = false): void {
	if (typeof value === "string") {
		if (!value || value === boundedSynthesis || STRUCTURAL_VALUE_KEYS.has(key ?? "")) return;
		if (OPAQUE_ID_KEYS.has(key ?? "")) opaqueIds.add(value);
		else if (keyedScalars) {
			const encoded = scalarFingerprint(value, key);
			if (encoded) structures.add(encoded);
		} else fragments.add(value);
		return;
	}
	if (value === null || typeof value === "boolean" || typeof value === "number") {
		const encoded = scalarFingerprint(value, key);
		if (encoded) structures.add(encoded);
		return;
	}
	if (Array.isArray(value)) {
		addStructures(value, structures);
		for (const item of value) addPrivateObservation(item, fragments, opaqueIds, structures, boundedSynthesis, key, keyedScalars);
		return;
	}
	if (!isRecord(value)) return;
	addStructures(value, structures);
	for (const [childKey, child] of Object.entries(value))
		addPrivateObservation(child, fragments, opaqueIds, structures, boundedSynthesis, childKey, keyedScalars);
}

/** Only final assistant protocol metadata may recur in a parent provider request. */
function addFinalAssistantPrivateOrigins(message: Record<string, unknown>, fragments: Set<string>, opaqueIds: Set<string>, structures: Set<string>, boundedSynthesis: string): void {
	for (const [key, value] of Object.entries(message)) {
		if (key === "role" || FINAL_ASSISTANT_METADATA_KEYS.has(key)) continue;
		if (key === "reasoning" && isRecord(value)) {
			const privateReasoning = Object.fromEntries(Object.entries(value).filter(([reasoningKey]) => !FINAL_REASONING_METADATA_KEYS.has(reasoningKey)));
			if (Object.keys(privateReasoning).length > 0) addPrivateObservation(privateReasoning, fragments, opaqueIds, structures, boundedSynthesis, key);
			continue;
		}
		if (key !== "content" || !Array.isArray(value)) {
			addPrivateObservation(value, fragments, opaqueIds, structures, boundedSynthesis, key);
			continue;
		}
		for (const part of value) {
			if (isRecord(part) && part.type === "text" && part.text === boundedSynthesis) continue;
			if (!isRecord(part) || part.type !== "thinking") {
				addPrivateObservation(part, fragments, opaqueIds, structures, boundedSynthesis);
				continue;
			}
			const privateThinking = Object.fromEntries(Object.entries(part).filter(([thinkingKey]) => thinkingKey !== "type" && !FINAL_THINKING_METADATA_KEYS.has(thinkingKey)));
			if (Object.keys(privateThinking).length > 0) addPrivateObservation(privateThinking, fragments, opaqueIds, structures, boundedSynthesis);
		}
	}
}

const PUBLIC_RESEARCH_DETAIL_KEYS = new Set(["kind", "agentScope", "model", "reasoningLevel", "effectiveTools", "input", "files", "webResearch", "effort", "failed", "results", "session"]);

function privateOrigins(results: readonly unknown[], outerDetails: unknown, boundedSynthesis: string): { fragments: string[]; opaqueIds: string[]; structures: string[] } {
	const fragments = new Set<string>();
	const opaqueIds = new Set<string>();
	const structures = new Set<string>();
	if (isRecord(outerDetails)) {
		for (const [key, value] of Object.entries(outerDetails)) {
			if (PUBLIC_RESEARCH_DETAIL_KEYS.has(key)) continue;
			// Unknown outer fields default private, covering future diagnostics and
			// extensions without treating the trusted handoff as child evidence.
			addPrivateObservation(value, fragments, opaqueIds, structures, boundedSynthesis, key, true);
		}
		if (isRecord(outerDetails.session) && typeof outerDetails.session.childSessionId === "string") opaqueIds.add(outerDetails.session.childSessionId);
	}
	for (const result of results) {
		if (!isRecord(result)) continue;
		const messages = Array.isArray(result.messages) ? result.messages : [];
		const finalAssistant = messages.findLastIndex((message) => isRecord(message) && message.role === "assistant");
		for (const [index, message] of messages.entries()) {
			if (!isRecord(message) || message.role === "user") continue;
			if (message.role === "assistant" && index === finalAssistant && Array.isArray(message.content))
				addFinalAssistantPrivateOrigins(message, fragments, opaqueIds, structures, boundedSynthesis);
			else addPrivateObservation(message, fragments, opaqueIds, structures, boundedSynthesis);
		}
		for (const [key, value] of Object.entries(result)) {
			if (["agent", "agentSource", "task", "status", "messages", "usage", "details"].includes(key)) continue;
			addPrivateObservation(value, fragments, opaqueIds, structures, boundedSynthesis, key);
		}
		addPrivateObservation(result.details, fragments, opaqueIds, structures, boundedSynthesis);
		addPrivateObservation(result.usage, fragments, opaqueIds, structures, boundedSynthesis);
	}
	return { fragments: [...fragments], opaqueIds: [...opaqueIds], structures: [...structures] };
}

function publicOriginsBeforeResearch(messages: readonly unknown[], resultIndex: number): { strings: Set<string>; structures: Set<string> } {
	const strings = new Set<string>();
	const structures = new Set<string>();
	for (const message of messages.slice(0, resultIndex)) {
		if (isResearchResultLike(message)) continue;
		collectPublic(message, strings, structures);
	}
	return { strings, structures };
}

function trustedOriginsByRun(messages: readonly unknown[], runs: ReadonlyMap<string, PrivateRun>): Map<string, { strings: Set<string>; structures: Set<string> }> {
	const trusted = new Map<string, { strings: Set<string>; structures: Set<string> }>();
	for (const [index, message] of messages.entries()) {
		if (!isResearchToolResult(message) || trusted.has(message.toolCallId) || !runs.has(message.toolCallId)) continue;
		trusted.set(message.toolCallId, publicOriginsBeforeResearch(messages, index));
	}
	return trusted;
}

function collectPublic(value: unknown, strings: Set<string>, structures: Set<string>, key?: string): void {
	if (typeof value === "string") {
		if (value) strings.add(value);
		const encoded = scalarFingerprint(value, key);
		if (encoded) structures.add(encoded);
		return;
	}
	if (value === null || typeof value === "boolean" || typeof value === "number") {
		const encoded = scalarFingerprint(value, key);
		if (encoded) structures.add(encoded);
		return;
	}
	if (Array.isArray(value)) {
		addStructures(value, structures);
		for (const child of value) collectPublic(child, strings, structures, key);
		return;
	}
	if (isRecord(value)) {
		addStructures(value, structures);
		for (const [childKey, child] of Object.entries(value)) collectPublic(child, strings, structures, childKey);
	}
}

function containsPrivateText(value: unknown, fragments: readonly string[], trustedParentStrings: ReadonlySet<string>, boundedSynthesis: string): boolean {
	if (typeof value === "string") {
		if (value === boundedSynthesis || trustedParentStrings.has(value)) return false;
		return fragments.some((fragment) => value.includes(fragment));
	}
	if (Array.isArray(value)) return value.some((item) => containsPrivateText(item, fragments, trustedParentStrings, boundedSynthesis));
	return isRecord(value) && Object.values(value).some((item) => containsPrivateText(item, fragments, trustedParentStrings, boundedSynthesis));
}

function containsOpaqueId(value: unknown, ids: readonly string[], trustedParentStrings: ReadonlySet<string>): boolean {
	if (typeof value === "string") return !trustedParentStrings.has(value) && ids.includes(value);
	if (Array.isArray(value)) return value.some((item) => containsOpaqueId(item, ids, trustedParentStrings));
	return isRecord(value) && Object.values(value).some((item) => containsOpaqueId(item, ids, trustedParentStrings));
}

function containsPrivateStructure(value: unknown, structures: readonly string[], trustedParentStructures: ReadonlySet<string>, key?: string): boolean {
	const encoded = value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number"
		? scalarFingerprint(value, key)
		: fingerprint(value);
	if (encoded && trustedParentStructures.has(encoded)) return false;
	if (encoded && structures.includes(encoded)) return true;
	if (Array.isArray(value)) return value.some((child) => containsPrivateStructure(child, structures, trustedParentStructures, key));
	if (isRecord(value)) return Object.entries(value).some(([childKey, child]) => containsPrivateStructure(child, structures, trustedParentStructures, childKey));
	return false;
}

function containsPrivateOrigin(value: unknown, run: PrivateRun): boolean {
	return containsPrivateText(value, run.privateFragments, run.trustedParentStrings, run.safeContent[0].text)
		|| containsOpaqueId(value, run.privateOpaqueIds, run.trustedParentStrings)
		|| containsPrivateStructure(value, run.privateStructures, run.trustedParentStructures);
}

function isResearchToolResult(message: unknown): message is AgentMessage & { role: "toolResult"; toolName: "research"; toolCallId: string } {
	return isRecord(message) && message.role === "toolResult" && message.toolName === "research" && typeof message.toolCallId === "string";
}

function isResearchResultLike(message: unknown): message is AgentMessage {
	return isRecord(message) && message.role === "toolResult" && message.toolName === "research";
}

/** A provider call ID may be the native prefix of Pi's composite call/item ID. */
function runForProviderCallId(value: unknown, runs: readonly PrivateRun[]): PrivateRun | undefined {
	if (typeof value !== "string") return undefined;
	return runs.find((run) => value === run.toolCallId || run.toolCallId.startsWith(`${value}|`));
}

function safeResearchMessage(message: AgentMessage, run: PrivateRun | undefined): AgentMessage {
	const candidate = message as unknown as Record<string, unknown>;
	const content = safeContent(candidate.content);
	const unsafe = !run || !content || !sameContent(content, run.safeContent);
	const safe: Record<string, unknown> = {
		role: "toolResult",
		toolName: "research",
		...(typeof candidate.toolCallId === "string" ? { toolCallId: candidate.toolCallId } : {}),
		content: unsafe ? [{ type: "text", text: RESEARCH_ISOLATION_ERROR }] : content,
	};
	if (typeof candidate.isError === "boolean") safe.isError = candidate.isError;
	return safe as AgentMessage;
}

function safeGenericMessage(message: AgentMessage): AgentMessage {
	return { role: (message as unknown as { role?: string }).role ?? "user", content: [{ type: "text", text: RESEARCH_ISOLATION_ERROR }] } as AgentMessage;
}

function textContent(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (Array.isArray(value) && value.length === 1 && isRecord(value[0]) && value[0].type === "text" && typeof value[0].text === "string") return value[0].text;
	return undefined;
}

interface ProviderCheck {
	leakingRunIds: Set<string>;
	correlatedRunIds: Set<string>;
	repairedPayload?: unknown;
	invalidPayload?: boolean;
}

const REGISTERED_WEBFETCH_SCHEMA = fingerprint({
	type: "object",
	required: ["url"],
	properties: {
		url: { type: "string", minLength: 1, pattern: "\\S", description: "Known direct HTTP(S) URL to retrieve" },
		format: { type: "string", enum: ["text", "markdown", "html"], default: "markdown", description: "Return format. Defaults to markdown." },
		timeout: { type: "number", exclusiveMinimum: 0, maximum: 120, default: 30, description: "Timeout in seconds. Defaults to 30; maximum 120." },
	},
	additionalProperties: false,
});

/** Repair only the exact registered webfetch schema retained in the v7 fixture. */
function namedTools(payload: Record<string, unknown>): { payload: Record<string, unknown>; valid: boolean } {
	if (!Array.isArray(payload.tools)) return { payload, valid: true };
	let changed = false;
	const tools = payload.tools.map((tool) => {
		if (!isRecord(tool) || tool.type !== "function") return tool;
		if (isRecord(tool.function) && typeof tool.function.name === "string" && tool.function.name.trim()) return tool;
		if (typeof tool.name === "string" && tool.name.trim()) return tool;
		const keys = Object.keys(tool).sort();
		if (keys.join("|") === "parameters|strict|type" && fingerprint(tool.parameters) === REGISTERED_WEBFETCH_SCHEMA) {
			changed = true;
			return { ...tool, name: "webfetch" };
		}
		return tool;
	});
	const valid = tools.every((tool) => !isRecord(tool) || tool.type !== "function" || (isRecord(tool.function) && typeof tool.function.name === "string" && tool.function.name.trim()) || (typeof tool.name === "string" && tool.name.trim()));
	return { payload: changed ? { ...payload, tools } : payload, valid };
}

function providerCheck(payload: unknown, runs: readonly PrivateRun[]): ProviderCheck {
	const leakingRunIds = new Set<string>();
	const correlatedRunIds = new Set<string>();
	if (!isRecord(payload)) return { leakingRunIds, correlatedRunIds, invalidPayload: true };
	const expected = runs.filter((run) => run.contextPresented);
	const mark = (run?: PrivateRun) => {
		if (run) leakingRunIds.add(run.toolCallId);
		else for (const candidate of expected) leakingRunIds.add(candidate.toolCallId);
	};
	const named = namedTools(payload);
	if (!named.valid) {
		mark();
		return { leakingRunIds, correlatedRunIds };
	}
	let current = named.payload;
	const inputKey = Array.isArray(current.input) ? "input" : Array.isArray(current.messages) ? "messages" : undefined;
	if (inputKey) {
		const cleaned = (current[inputKey] as unknown[]).map((item) => isResearchResultLike(item) ? safeResearchMessage(item, isResearchToolResult(item) ? runForProviderCallId(item.toolCallId, runs) : undefined) : item);
		if (JSON.stringify(cleaned) !== JSON.stringify(current[inputKey])) current = { ...current, [inputKey]: cleaned };
	}
	const input = inputKey ? current[inputKey] as unknown[] : [];
	const nativeCalls = new Map<string, string[]>();
	const nativeOutputs = new Map<string, Array<{ id: string; output: unknown }>>();
	const noteCall = (id: unknown, name: unknown) => {
		if (name !== "research" || typeof id !== "string") return;
		const run = runForProviderCallId(id, expected);
		if (!run) return;
		const calls = nativeCalls.get(run.toolCallId) ?? [];
		calls.push(id);
		nativeCalls.set(run.toolCallId, calls);
		correlatedRunIds.add(run.toolCallId);
	};
	const noteOutput = (id: unknown, output: unknown) => {
		if (typeof id !== "string") return;
		// Outputs are correlated only after a Research call selects its native ID.
		// A prefix-compatible composite output must never satisfy that pair.
		for (const run of expected) {
			if (!(nativeCalls.get(run.toolCallId) ?? []).includes(id)) continue;
			const outputs = nativeOutputs.get(run.toolCallId) ?? [];
			outputs.push({ id, output });
			nativeOutputs.set(run.toolCallId, outputs);
			correlatedRunIds.add(run.toolCallId);
		}
	};
	const hasPrivate = (value: unknown) => {
		for (const run of runs) if (containsPrivateOrigin(value, run)) leakingRunIds.add(run.toolCallId);
	};
	// Payload-only fields such as instructions, metadata, tool configuration,
	// and provider extensions are model-visible too. Inspect the complete
	// serialized payload rather than only its message envelope.
	hasPrivate(current);
	// First select exactly one native Research call for every presented run.
	for (const item of input) {
		if (!isRecord(item)) continue;
		if (item.type === "function_call") noteCall(item.call_id, item.name);
		if (Array.isArray(item.tool_calls)) for (const call of item.tool_calls) {
			if (!isRecord(call) || !isRecord(call.function)) {
				mark();
				continue;
			}
			noteCall(call.id, call.function.name);
		}
		if (Array.isArray(item.content)) for (const part of item.content)
			if (isRecord(part) && part.type === "tool_use") noteCall(part.id, part.name);
	}
	// Then require exactly one output with the selected exact native ID.
	for (const item of input) {
		if (!isRecord(item)) continue;
		if (item.type === "function_call_output") noteOutput(item.call_id, item.output);
		if (item.role === "tool") noteOutput(item.tool_call_id, item.content);
		if (Array.isArray(item.content)) for (const part of item.content)
			if (isRecord(part) && part.type === "tool_result") noteOutput(part.tool_use_id, part.content);
	}
	for (const run of expected) {
		const calls = nativeCalls.get(run.toolCallId) ?? [];
		const outputs = nativeOutputs.get(run.toolCallId) ?? [];
		if (calls.length !== 1 || outputs.length !== 1 || outputs[0]?.id !== calls[0] || textContent(outputs[0]?.output) !== run.safeContent[0].text) mark(run);
	}
	return { leakingRunIds, correlatedRunIds, repairedPayload: current === payload ? undefined : current };
}

function isResponsesApi(api: ProviderApi, payload: Record<string, unknown>): boolean {
	if (api === "openai-responses" || api === "openai-codex-responses" || api === "azure-openai-responses") return true;
	return api === undefined && Array.isArray(payload.input) && payload.input.some((item) => isRecord(item) && (item.type === "function_call" || item.type === "function_call_output"));
}

function isAnthropicApi(api: ProviderApi, payload: Record<string, unknown>): boolean {
	if (api === "anthropic-messages") return true;
	return api === undefined && Array.isArray(payload.messages) && payload.messages.some((message) => isRecord(message) && Array.isArray(message.content) && message.content.some((part) => isRecord(part) && (part.type === "tool_use" || part.type === "tool_result")));
}

type ProviderModelContext = { id?: unknown; maxTokens?: unknown } | string | undefined;

function safeProviderReplacement(payload: unknown, api: ProviderApi, fallback?: ProviderModelContext, trustSourceModel = true): unknown {
	const source = isRecord(payload) ? payload : {};
	const contextModel = typeof fallback === "string" ? fallback : fallback?.id;
	const contextMaxTokens = typeof fallback === "object" && fallback !== null ? fallback.maxTokens : undefined;
	// The hook context identifies the active provider model. Prefer it over a
	// malformed or stale serialized field (for example the v7 `None` model).
	// A source model known to be child evidence cannot supply safe metadata.
	const model = typeof contextModel === "string" ? contextModel : trustSourceModel && typeof source.model === "string" ? source.model : undefined;
	const stream = typeof source.stream === "boolean" ? source.stream : true;
	if (isResponsesApi(api, source)) return {
		...(typeof model === "string" ? { model } : {}),
		...(typeof source.max_output_tokens === "number" ? { max_output_tokens: source.max_output_tokens } : {}),
		stream,
		input: [{ role: "user", content: [{ type: "input_text", text: RESEARCH_ISOLATION_ERROR }] }],
	};
	if (isAnthropicApi(api, source)) return {
		...(typeof model === "string" ? { model } : {}),
		max_tokens: typeof source.max_tokens === "number" ? source.max_tokens : typeof contextMaxTokens === "number" ? contextMaxTokens : 256,
		stream,
		messages: [{ role: "user", content: RESEARCH_ISOLATION_ERROR }],
	};
	return {
		...(typeof model === "string" ? { model } : {}),
		...(typeof source.max_tokens === "number" ? { max_tokens: source.max_tokens } : {}),
		...(typeof source.max_completion_tokens === "number" ? { max_completion_tokens: source.max_completion_tokens } : {}),
		...(typeof source.maxTokens === "number" ? { maxTokens: source.maxTokens } : {}),
		stream,
		messages: [{ role: "user", content: RESEARCH_ISOLATION_ERROR }],
	};
}

export class ResearchBoundaryTracker {
	private readonly pending: PrivateRun[] = [];
	private readonly observed = new Set<string>();
	private readonly unmatchedTelemetry: ResearchIsolationTelemetry[] = [];
	private unmatchedContextLeak = false;

	record(result: ResearchToolResult, toolCallId: string): void {
		this.observed.add(toolCallId);
		const content = safeContent(result.content);
		if (!content) return;
		const children = result.details?.results ?? [];
		const origins = privateOrigins(children, result.details, content[0].text);
		const fragments = new Set(origins.fragments);
		const opaqueIds = new Set(origins.opaqueIds);
		const structures = new Set(origins.structures);
		const childUsage = children.reduce((total, child) => {
			const value = usage(child.usage);
			return {
				input: total.input + value.input, output: total.output + value.output,
				cacheRead: total.cacheRead + value.cacheRead, cacheWrite: total.cacheWrite + value.cacheWrite,
				cost: total.cost + value.cost, contextTokens: total.contextTokens + value.contextTokens, turns: total.turns + value.turns,
			};
		}, usage(undefined));
		const existing = this.pending.findIndex((run) => run.toolCallId === toolCallId);
		if (existing >= 0) this.pending.splice(existing, 1);
		this.pending.push({
			toolCallId,
			safeContent: content,
			privateFragments: [...fragments],
			privateOpaqueIds: [...opaqueIds],
			privateStructures: [...structures],
			childUsage,
			totalUsage: usage(result.details?.usage),
			contextPresented: false,
			contextLeakDetected: false,
			trustedParentStrings: new Set(),
			trustedParentStructures: new Set(),
		});
	}

	inspectContext(messages: AgentMessage[]): { leaked: boolean; messages: AgentMessage[] } {
		for (const message of messages) if (isResearchToolResult(message) && !this.observed.has(message.toolCallId)) this.record(message as unknown as ResearchToolResult, message.toolCallId);
		const byId = new Map(this.pending.map((run) => [run.toolCallId, run]));
		for (const [toolCallId, trusted] of trustedOriginsByRun(messages, byId)) {
			const run = byId.get(toolCallId)!;
			for (const text of trusted.strings) run.trustedParentStrings.add(text);
			for (const structure of trusted.structures) run.trustedParentStructures.add(structure);
		}
		const seen = new Set<string>();
		let leaked = false;
		const delivered: AgentMessage[] = [];
		for (const message of messages) {
			if (isResearchResultLike(message)) {
				const run = isResearchToolResult(message) ? byId.get(message.toolCallId) : undefined;
				if (!run) {
					leaked = true;
					this.unmatchedContextLeak = true;
				this.unmatchedTelemetry.push({ toolCallId: "unmatched", modelVisibleBytes: 0, modelVisibleTokenEstimate: 0, leakDetected: true, childUsage: usage(undefined), totalUsage: usage(undefined) });
					delivered.push(safeResearchMessage(message, undefined));
					continue;
				}
				if (seen.has(run.toolCallId)) {
					leaked = true;
					run.contextLeakDetected = true;
					continue;
				}
				seen.add(run.toolCallId);
				const safe = safeResearchMessage(message, run);
				if (safe.content[0]?.text === RESEARCH_ISOLATION_ERROR) {
					leaked = true;
					run.contextLeakDetected = true;
				}
				delivered.push(safe);
				continue;
			}
			const tainted = this.pending.some((run) => containsPrivateOrigin(message, run));
			if (tainted) {
				leaked = true;
				for (const run of this.pending) if (containsPrivateOrigin(message, run)) run.contextLeakDetected = true;
				delivered.push(safeGenericMessage(message));
			} else delivered.push(message);
		}
		this.captureContextTelemetry(delivered);
		return { leaked, messages: delivered };
	}

	inspectProvider(payload: unknown, api?: ProviderApi, fallback?: ProviderModelContext): { leaked: boolean; payload?: unknown; runIds: Set<string> } {
		const check = providerCheck(payload, this.pending);
		for (const run of this.pending) if (run.contextLeakDetected) check.leakingRunIds.add(run.toolCallId);
		const unmatchedContextLeak = this.unmatchedContextLeak;
		this.unmatchedContextLeak = false;
		const correlated = new Set([...check.correlatedRunIds].filter((id) => this.pending.find((run) => run.toolCallId === id)?.contextPresented));
		if (check.invalidPayload || check.leakingRunIds.size > 0 || unmatchedContextLeak) {
			const sourceModelIsPrivate = isRecord(payload) && this.pending.some((run) =>
				containsPrivateText(payload.model, run.privateFragments, run.trustedParentStrings, run.safeContent[0].text)
				|| containsOpaqueId(payload.model, run.privateOpaqueIds, run.trustedParentStrings)
				|| containsPrivateStructure(payload.model, run.privateStructures, run.trustedParentStructures, "model"));
			const replacement = safeProviderReplacement(payload, api, fallback, !sourceModelIsPrivate);
			const affected = this.pending.filter((run) => run.contextPresented);
			for (const run of affected) {
				const telemetry = run.telemetry ?? this.newTelemetry(run, []);
				telemetry.leakDetected = true;
				telemetry.providerReplacement = true;
				telemetry.attemptedProviderPayloadBytes = serializedBytes(payload);
				telemetry.providerPayloadBytes = serializedBytes(replacement);
				telemetry.providerPayloadTokenEstimate = Math.ceil(telemetry.providerPayloadBytes / 4);
				run.telemetry = telemetry;
				correlated.add(run.toolCallId);
			}
			return { leaked: true, payload: replacement, runIds: correlated };
		}
		const delivered = check.repairedPayload ?? payload;
		for (const run of this.pending) {
			if (!check.correlatedRunIds.has(run.toolCallId) || !run.contextPresented) continue;
			const telemetry = run.telemetry ?? this.newTelemetry(run, []);
			telemetry.providerPayloadBytes = serializedBytes(delivered);
			telemetry.providerPayloadTokenEstimate = Math.ceil(telemetry.providerPayloadBytes / 4);
			if (check.repairedPayload) telemetry.attemptedProviderPayloadBytes = serializedBytes(payload);
			run.telemetry = telemetry;
		}
		return { leaked: false, payload: check.repairedPayload, runIds: correlated };
	}

	recordAbortedProviderReplacement(): void {
		for (const run of this.pending) {
			if (!run.contextPresented) continue;
			const telemetry = run.telemetry ?? this.newTelemetry(run, []);
			telemetry.leakDetected = true;
			telemetry.providerReplacement = true;
			telemetry.providerGuardReplacement = true;
			run.telemetry = telemetry;
		}
	}

	consumeTelemetry(toolCallIds: ReadonlySet<string>): ResearchIsolationTelemetry[] {
		const consumed: PrivateRun[] = [];
		for (let index = this.pending.length - 1; index >= 0; index--) {
			const run = this.pending[index];
			if (!toolCallIds.has(run.toolCallId)) continue;
			consumed.push(...this.pending.splice(index, 1));
		}
		for (const run of consumed) this.observed.delete(run.toolCallId);
		const unmatched = this.unmatchedTelemetry.splice(0);
		return [...consumed.reverse().map((run) => run.telemetry ?? this.newTelemetry(run, [])), ...unmatched];
	}

	hasPendingRuns(): boolean {
		return this.pending.length > 0 || this.unmatchedContextLeak;
	}

	flushTelemetry(): ResearchIsolationTelemetry[] {
		return this.consumeTelemetry(new Set(this.pending.map((run) => run.toolCallId)));
	}

	private captureContextTelemetry(messages: AgentMessage[]): void {
		for (const run of this.pending) {
			const visible = messages.filter((message) => isResearchToolResult(message) && message.toolCallId === run.toolCallId);
			if (visible.length !== 1) continue;
			run.contextPresented = true;
			const telemetry = run.telemetry ?? this.newTelemetry(run, visible);
			telemetry.modelVisibleBytes = serializedBytes(visible);
			telemetry.modelVisibleTokenEstimate = Math.ceil(telemetry.modelVisibleBytes / 4);
			run.telemetry = telemetry;
		}
	}

	private newTelemetry(run: PrivateRun, visible: unknown[]): ResearchIsolationTelemetry {
		const modelVisibleBytes = serializedBytes(visible);
		return { toolCallId: run.toolCallId, modelVisibleBytes, modelVisibleTokenEstimate: Math.ceil(modelVisibleBytes / 4), leakDetected: run.contextLeakDetected, childUsage: { ...run.childUsage }, totalUsage: { ...run.totalUsage } };
	}
}

export function registerResearchBoundary(pi: BoundaryAPI, tracker: ResearchBoundaryTracker): void {
	const append = (entries: ResearchIsolationTelemetry[]) => {
		for (const telemetry of entries) pi.appendEntry?.(RESEARCH_ISOLATION_ENTRY, telemetry);
	};
	const terminalPayload = async (payload: unknown, model: Model<Api>) => {
		// Extension handlers can replace the payload in load order. This runs
		// after all of them, inside the native adapter immediately before I/O.
		if (!tracker.hasPendingRuns()) return payload;
		const inspected = tracker.inspectProvider(payload, model.api, model);
		append(tracker.consumeTelemetry(inspected.runIds));
		return inspected.payload ?? payload;
	};
	const guardOptions = <T extends Api>(options: ApiStreamOptions<T> | undefined): ApiStreamOptions<T> => {
		if (options === undefined) return { onPayload: terminalPayload };
		const originalOnPayload = options.onPayload;
		const callbacks = new Map<PropertyKey, { source: unknown; callback: unknown }>();
		return new Proxy(options, {
			get(target, property) {
				const source = Reflect.get(target, property, target);
				const cached = callbacks.get(property);
				if (cached && cached.source === source) return cached.callback;
				if (property === "onPayload") {
					const callback = async (payload: unknown, model: Model<T>) => {
						const transformed = await originalOnPayload?.call(target, payload, model);
						return terminalPayload(transformed === undefined ? payload : transformed, model);
					};
					callbacks.set(property, { source, callback });
					return callback;
				}
				if (typeof source !== "function") return source;
				const callback = source.bind(target);
				callbacks.set(property, { source, callback });
				return callback;
			},
		});
	};
	const guardSimpleOptions = (options: SimpleStreamOptions | undefined): SimpleStreamOptions => {
		if (options === undefined) return { onPayload: terminalPayload };
		const originalOnPayload = options.onPayload;
		const callbacks = new Map<PropertyKey, { source: unknown; callback: unknown }>();
		return new Proxy(options, {
			get(target, property) {
				const source = Reflect.get(target, property, target);
				const cached = callbacks.get(property);
				if (cached && cached.source === source) return cached.callback;
				if (property === "onPayload") {
					const callback = async (payload: unknown, model: Model<Api>) => {
						const transformed = await originalOnPayload?.call(target, payload, model);
						return terminalPayload(transformed === undefined ? payload : transformed, model);
					};
					callbacks.set(property, { source, callback });
					return callback;
				}
				if (typeof source !== "function") return source;
				const callback = source.bind(target);
				callbacks.set(property, { source, callback });
				return callback;
			},
		});
	};
	const guardedProviders = new WeakSet<Provider>();
	const wrappers = new WeakMap<Provider, Provider>();
	const wrapProvider = (provider: Provider): Provider => {
		const existing = wrappers.get(provider);
		if (existing) return existing;
		const methods = new Map<PropertyKey, { source: unknown; bound: unknown }>();
		const guarded = new Proxy(provider, {
			get(target, property) {
				if (property === "stream") return <T extends Api>(model: Model<T>, context: Context, options?: ApiStreamOptions<T>) =>
					target.stream(model, context, guardOptions(options));
				if (property === "streamSimple") return (model: Model<Api>, context: Context, options?: SimpleStreamOptions) =>
					target.streamSimple(model, context, guardSimpleOptions(options));
				const value = Reflect.get(target, property, target);
				if (typeof value !== "function") return value;
				const cached = methods.get(property);
				if (cached?.source === value) return cached.bound;
				const bound = value.bind(target);
				methods.set(property, { source: value, bound });
				return bound;
			},
		});
		wrappers.set(provider, guarded);
		// ModelRegistry may expose the provider composition base rather than the
		// registered Proxy. Mark both public identities as this boundary's guard.
		guardedProviders.add(provider);
		guardedProviders.add(guarded);
		return guarded;
	};
	type ProviderContext = { model?: Model<Api>; modelRegistry: { getProvider(provider: string): Provider | undefined }; abort?: () => void };
	const wrapActiveProvider = (ctx: ProviderContext): boolean => {
		const providerId = ctx.model?.provider;
		if (!providerId) return false;
		const selected = ctx.modelRegistry.getProvider(providerId);
		if (!selected || guardedProviders.has(selected)) return false;
		pi.registerProvider?.(wrapProvider(selected));
		return true;
	};
	pi.on("context", (event) => {
		const inspected = tracker.inspectContext(event.messages);
		event.messages.splice(0, event.messages.length, ...inspected.messages);
		return { messages: inspected.messages };
	});
	pi.on("before_provider_request", (event, ctx) => {
		if (typeof pi.registerProvider !== "function") {
			// Narrow test-harness compatibility. Real ExtensionAPI instances always
			// take the provider-boundary path below.
			const inspected = tracker.inspectProvider(event.payload, ctx?.model?.api, ctx?.model);
			append(tracker.consumeTelemetry(inspected.runIds));
			return inspected.payload;
		}
		if (!tracker.hasPendingRuns()) return undefined;
		const providerId = ctx?.model?.provider;
		const selected = providerId ? ctx.modelRegistry.getProvider(providerId) : undefined;
		if (selected && guardedProviders.has(selected)) return undefined;
		// A later extension can replace the provider after before_agent_start.
		// Abort before later handlers can carry their replacement payload to I/O,
		// then wrap the selected provider for a clean future attempt.
		if (selected) pi.registerProvider(wrapProvider(selected));
		tracker.recordAbortedProviderReplacement();
		ctx.abort();
		return safeProviderReplacement(event.payload, ctx.model?.api, ctx.model);
	});
	if (typeof pi.registerProvider === "function") {
		pi.on("session_start", (_event, ctx) => wrapActiveProvider(ctx));
		pi.on("before_agent_start", (_event, ctx) => wrapActiveProvider(ctx));
		pi.on("model_select", (_event, ctx) => wrapActiveProvider(ctx));
	}
	pi.on("agent_settled", () => append(tracker.flushTelemetry()));
	pi.on("session_shutdown", () => append(tracker.flushTelemetry()));
}

export function serializedModelBytes(value: unknown): number {
	return serializedBytes(value);
}
