import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { RESEARCH_MAX_BYTES, RESEARCH_MAX_LINES } from "./research.ts";
import { RESEARCH_ISOLATION_ENTRY, serializedModelBytes } from "./research-boundary.ts";

const piPackageDirectory = path.join(execFileSync("npm", ["root", "--global"], { encoding: "utf8" }).trim(), "@earendil-works/pi-coding-agent");
const piRuntimeModules = new Map([
	["@earendil-works/pi-agent-core", "node_modules/@earendil-works/pi-agent-core/dist/index.js"],
	["@earendil-works/pi-ai", "node_modules/@earendil-works/pi-ai/dist/index.js"],
	["@earendil-works/pi-coding-agent", "dist/index.js"],
	["@earendil-works/pi-tui", "node_modules/@earendil-works/pi-tui/dist/index.js"],
	["typebox", "node_modules/typebox/build/index.mjs"],
].map(([specifier, modulePath]) => [specifier, pathToFileURL(path.join(piPackageDirectory, modulePath)).href]));
registerHooks({
	resolve(specifier, context, nextResolve) {
		const url = piRuntimeModules.get(specifier);
		return url === undefined ? nextResolve(specifier, context) : { url, shortCircuit: true };
	},
});

type Handler = (event: any, ctx?: any) => any;
type RegisteredTool = { name: string; execute: (...args: any[]) => Promise<any> };
type ChildOverrides = Record<string, unknown>;

function childResult(output: string, marker: string, overrides: ChildOverrides = {}) {
	return { agent: "researcher", agentSource: "user", task: "handoff", status: "completed", exitCode: 0, stderr: "", malformedStdout: "", usage: { input: 101, output: 17, cacheRead: 19, cacheWrite: 23, cost: 0.5, contextTokens: 118, turns: 2 }, messages: [
		{ role: "assistant", content: [{ type: "toolCall", id: "private-call", name: "webfetch", arguments: { url: "https://private.test/evidence" } }] },
		{ role: "toolResult", toolCallId: "private-call", toolName: "webfetch", content: [{ type: "text", text: marker }] },
		{ role: "assistant", content: [{ type: "text", text: output }] },
	], ...overrides };
}
function matrixOutput(bytes: number, lines: number): string { const separators = lines - 1; assert.ok(bytes > separators); return "x\n".repeat(separators) + "x".repeat(bytes - separators); }
function assertBoundedUtf8(text: string): void { assert.ok(Buffer.byteLength(text, "utf8") <= RESEARCH_MAX_BYTES); assert.ok(text.split("\n").length <= RESEARCH_MAX_LINES); assert.equal(Buffer.from(text, "utf8").toString("utf8"), text); assert.equal(text.includes("\uFFFD"), false); }

async function researchHarness(runResearch: (request: any) => Promise<any>) {
	const { registerSubagentExtension } = await import("./index.ts");
	const tools: RegisteredTool[] = [];
	const handlers = new Map<string, Handler>();
	const entries: Array<{ customType: string; data: unknown }> = [];
	let activeTools = ["read", "grep", "find", "ls", "websearch", "webfetch"];
	registerSubagentExtension({
		registerTool(tool: RegisteredTool) { tools.push(tool); },
		on(event: string, handler: Handler) {
			const previous = handlers.get(event);
			handlers.set(event, (current: any, ctx?: any) => {
				const previousResult = previous?.(current, ctx);
				if (event === "context" && previousResult?.messages) current.messages = previousResult.messages;
				if (event === "before_provider_request" && previousResult !== undefined) current.payload = previousResult;
				const next = handler(current, ctx);
				if (event === "context" && next?.messages) current.messages = next.messages;
				if (event === "before_provider_request" && next !== undefined) current.payload = next;
				return next ?? previousResult;
			});
		},
		appendEntry(customType: string, data: unknown) { entries.push({ customType, data }); },
		getActiveTools() { return activeTools; },
	} as never, { runResearch });
	const research = tools.find((tool) => tool.name === "research"); assert.ok(research);
	return { research, handlers, entries, setActiveTools(tools: string[]) { activeTools = tools; } };
}
function deliver(harness: Awaited<ReturnType<typeof researchHarness>>, result: any, toolCallId = "research-call") {
	const parent = [{ role: "user", content: [{ type: "text", text: "parent baseline" }] }, { role: "toolResult", toolName: "research", toolCallId, content: result.content, details: result.details, usage: { private: true }, isError: result.details.failed }];
	const context = structuredClone(parent); const contextResult = harness.handlers.get("context")!({ messages: context }); const deliveredContext = contextResult?.messages ?? context;
	const payload = { model: "fake", messages: deliveredContext, tools: [{ type: "function", function: { name: "research" } }] }; const providerResult = harness.handlers.get("before_provider_request")!({ payload });
	return { parent, context, deliveredContext, payload: providerResult ?? payload };
}

test("Research serialized parent growth is exact across the 8 KiB and 400-line matrix", async () => {
	const outputs: Array<{ output: string; marker: string }> = [];
	const harness = await researchHarness(async () => { const next = outputs.shift(); assert.ok(next); return childResult(next.output, next.marker); });
	const fixedOverheads = new Set<number>(); const growthByCell = new Map<string, number>();
	for (const bytes of [RESEARCH_MAX_BYTES - 1, RESEARCH_MAX_BYTES, RESEARCH_MAX_BYTES + 1]) for (const lines of [RESEARCH_MAX_LINES - 1, RESEARCH_MAX_LINES, RESEARCH_MAX_LINES + 1]) {
		const source = matrixOutput(bytes, lines); const key = `${bytes}/${lines}`; const growths: number[] = [];
		for (const privateBytes of [1, 128 * 1024]) {
			const marker = `matrix-private-${key}-${privateBytes}-${"p".repeat(privateBytes)}`; outputs.push({ output: source, marker });
			const result = await harness.research.execute("research-call", { task: `matrix ${key}` }, new AbortController().signal, undefined, { cwd: process.cwd(), model: undefined, thinkingLevel: undefined, hasUI: false });
			const text = result.content[0].text; assertBoundedUtf8(text); assert.ok(JSON.stringify(result.details).includes(marker)); assert.equal(JSON.stringify(result.content).includes(marker), false);
			const delivered = deliver(harness, result); const serialized = JSON.stringify({ context: delivered.context, payload: delivered.payload });
			assert.equal(delivered.deliveredContext[1].content[0].text, text); assert.equal((delivered.payload as { messages: Array<{ content: Array<{ text: string }> }> }).messages[1].content[0].text, text); assert.equal(serialized.includes(marker), false); assert.equal(serialized.includes('"details":'), false);
			const baseline = [{ role: "user", content: [{ type: "text", text: "parent baseline" }] }]; const growth = serializedModelBytes(delivered.deliveredContext) - serializedModelBytes(baseline); growths.push(growth); fixedOverheads.add(growth - Buffer.byteLength(text, "utf8"));
			const telemetry = harness.entries.at(-1)!; assert.equal(telemetry.customType, RESEARCH_ISOLATION_ENTRY); assert.equal(JSON.stringify(telemetry.data).includes(marker), false); assert.equal((telemetry.data as { modelVisibleBytes: number }).modelVisibleBytes, serializedModelBytes([delivered.deliveredContext[1]])); assert.equal((telemetry.data as { providerPayloadBytes: number }).providerPayloadBytes, serializedModelBytes(delivered.payload));
		}
		assert.equal(growths[0], growths[1], `${key} parent growth changed with private transcript size`); growthByCell.set(key, growths[0]);
	}
	assert.equal(growthByCell.size, 9); assert.deepEqual([...fixedOverheads], [526]);
});

test("Research lifecycle keeps success, preflight, failure, cancellation, and updates bounded and private", async () => {
	const requests: any[] = []; const markers = new Map<string, string>(); let phase = "success";
	const harness = await researchHarness(async (request) => {
		requests.push(request); const marker = `lifecycle-private-${phase}-${"z".repeat(16 * 1024)}`; markers.set(phase, marker);
		if (phase === "partial") { const partial = childResult("partial snapshot", marker, { status: "running" }); request.onUpdate?.({ content: [{ type: "text", text: "ignored" }], details: request.makeDetails([partial]) }); partial.messages[1].content[0].text = "mutated after update"; }
		if (phase === "failure") return childResult("child final should stay private", marker, { status: "failed", exitCode: 1, failureMessage: "Child transport failed." });
		if (phase === "cancellation") { assert.equal(request.signal?.aborted, true); return childResult("cancelled private progress", marker, { status: "failed", exitCode: 1, stopReason: "aborted", failureMessage: "Subagent was aborted." }); }
		return childResult(`## Answer\n${"s".repeat(RESEARCH_MAX_BYTES * 2)}`, marker);
	});
	const updates: any[] = []; const execute = async (params: Record<string, unknown>, signal = new AbortController().signal) => harness.research.execute("research-call", params, signal, (update: unknown) => updates.push(structuredClone(update)), { cwd: process.cwd(), model: undefined, thinkingLevel: undefined, hasUI: false });
	const success = await execute({ task: "success" }); phase = "failure"; const failure = await execute({ task: "failure" }); phase = "cancellation"; const cancellationController = new AbortController(); cancellationController.abort(); const cancellation = await execute({ task: "cancellation" }, cancellationController.signal); phase = "partial"; const partial = await execute({ task: "partial" }); const callsBeforePreflight = requests.length; harness.setActiveTools(["read"]); const preflight = await execute({ task: "preflight", webResearch: "required" }); assert.equal(requests.length, callsBeforePreflight);
	for (const [name, result, failed] of [["success", success, false], ["failure", failure, true], ["cancellation", cancellation, true], ["partial", partial, false]] as const) { const marker = markers.get(name)!; assertBoundedUtf8(result.content[0].text); assert.equal(result.details.failed, failed); assert.ok(JSON.stringify(result.details.results[0].messages).includes(marker)); assert.equal(result.details.results[0].usage.input, 101); assert.equal(JSON.stringify(result.content).includes(marker), false); const delivered = deliver(harness, result); const serialized = JSON.stringify({ context: delivered.context, payload: delivered.payload }); assert.equal(serialized.includes(marker), false); assert.equal(serialized.includes('"details":'), false); }
	assertBoundedUtf8(preflight.content[0].text); assert.equal(preflight.details.failed, true); assert.deepEqual(preflight.details.results, []); assert.match(preflight.content[0].text, /websearch and webfetch/); assert.equal(updates.length, 1); assertBoundedUtf8(updates[0].content[0].text); assert.match(JSON.stringify(updates[0].details.results[0].messages), /lifecycle-private-partial/); assert.doesNotMatch(JSON.stringify(updates[0].details.results[0].messages), /mutated after update/); assert.equal(requests.length, 4);
});

test("Research child masking preserves persisted evidence while shrinking only trusted child provider context", async () => {
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
	const { RESEARCH_PROTECTED_RECENT_TOKENS, ResearchContextTracker, registerResearchContext } = await import("./research-context.ts");
	const { RESEARCH_CHILD_ENV, ResearchSessionStore } = await import("./research-session.ts");
	const root = await fs.mkdtemp(path.join(process.cwd(), ".research-context-")); const sessionDir = path.join(root, "sessions");
	try {
		const parent = SessionManager.create(root, sessionDir); parent.appendMessage({ role: "assistant", content: [{ type: "text", text: "parent evidence" }], provider: "test", model: "test", usage: {}, stopReason: "stop", timestamp: Date.now() });
		const store = new ResearchSessionStore({ newResearchId: () => "r_77777777-7777-4777-8777-777777777777" }); const target = store.create(parent, root, ["read", "websearch", "webfetch"]); parent.appendCustomEntry("research-session", store.mapping(target)); const child = SessionManager.open(target.sessionFile, sessionDir);
		const message = (role: string, content: unknown, extra: Record<string, unknown> = {}) => ({ role, content, timestamp: Date.now(), ...extra }); const evidence = (id: string, toolName: "websearch" | "webfetch", text: string, extra: Record<string, unknown> = {}) => message("toolResult", [{ type: "text", text }], { toolCallId: id, toolName, ...extra });
		child.appendMessage(message("user", [{ type: "text", text: "first research task" }]));
		for (const index of [0, 1, 2, 3]) { const id = `old-${index}`; child.appendMessage(message("assistant", [{ type: "toolCall", id, name: index === 2 ? "webfetch" : "websearch", arguments: index === 2 ? { url: "https://citation.example/source" } : { query: `query ${index}` } }], { provider: "test", model: "test", usage: {}, stopReason: "toolUse" })); child.appendMessage(evidence(id, index === 2 ? "webfetch" : "websearch", `STALE-${index}-${"x".repeat(RESEARCH_PROTECTED_RECENT_TOKENS * 2)}`, index === 2 ? { details: { url: "https://citation.example/source", finalUrl: "https://citation.example/source" } } : { input: { query: `query ${index}` } })); }
		child.appendMessage(message("assistant", [{ type: "text", text: "first turn complete" }], { provider: "test", model: "test", usage: {}, stopReason: "stop" })); child.appendMessage(message("user", [{ type: "text", text: "second research task" }])); child.appendMessage(message("assistant", [{ type: "text", text: "cite https://citation.example/source" }], { provider: "test", model: "test", usage: {}, stopReason: "stop" })); child.appendMessage(message("user", [{ type: "text", text: "current research task" }])); child.appendMessage(message("assistant", [{ type: "toolCall", id: "current", name: "webfetch", arguments: { url: "https://recent.example" } }], { provider: "test", model: "test", usage: {}, stopReason: "toolUse" })); child.appendMessage(evidence("current", "webfetch", "RECENT-EXACT-EVIDENCE", { details: { url: "https://recent.example", finalUrl: "https://recent.example" } }));
		const before = await fs.readFile(target.sessionFile, "utf8"); const beforeHash = createHash("sha256").update(before).digest("hex"); const tracker = new ResearchContextTracker(); const handlers = new Map<string, Handler>(); const auditEntries: Array<{ customType: string; data: unknown }> = []; registerResearchContext({ on(event: string, handler: Handler) { handlers.set(event, handler); }, appendEntry(customType: string, data: unknown) { auditEntries.push({ customType, data }); } } as never, { environment: { [RESEARCH_CHILD_ENV]: target.childSessionId }, tracker });
		const original = child.buildSessionContext().messages; const event = { messages: structuredClone(original) }; const result = handlers.get("context")!(event, { sessionManager: child }); const delivered = result?.messages ?? event.messages; const serialized = JSON.stringify({ model: "fake", messages: delivered });
		assert.equal(serialized.includes("STALE-0-"), false); assert.equal(serialized.includes("STALE-1-"), false); assert.match(serialized, /kind=websearch; target=query 0; status=success; evidence-ref=websearch:old-0/); assert.match(serialized, /kind=websearch; target=query 1; status=success; evidence-ref=websearch:old-1/); assert.ok(serialized.includes("STALE-2-")); assert.ok(serialized.includes("STALE-3-")); assert.ok(serialized.includes("RECENT-EXACT-EVIDENCE")); assert.deepEqual(delivered.map((item: { role: string }) => item.role), original.map((item: { role: string }) => item.role)); assert.ok(tracker.telemetry[0].deliveredBytes < tracker.telemetry[0].originalBytes); assert.ok(tracker.telemetry[0].deliveredTokenEstimate < tracker.telemetry[0].originalTokenEstimate); assert.equal(JSON.stringify(tracker.telemetry).includes("STALE-0-"), false); assert.deepEqual(auditEntries, [{ customType: "research-context", data: tracker.telemetry[0] }], "masking measurements must be persisted as child audit data");
		const after = await fs.readFile(target.sessionFile, "utf8"); assert.equal(createHash("sha256").update(after).digest("hex"), beforeHash); assert.ok(after.includes("STALE-0-"));
		const parentSession = SessionManager.create(root, path.join(root, "ordinary-sessions")); const parentEvent = { messages: structuredClone(original) }; const parentResult = handlers.get("context")!(parentEvent, { sessionManager: parentSession }); assert.equal(parentResult, undefined); assert.deepEqual(parentEvent.messages, original);
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});
