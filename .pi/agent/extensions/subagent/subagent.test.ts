import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RESEARCH_MODEL } from "./research.ts";
import { renderDedicatedSingleCall, renderGenericSingleCall, renderSingleResult, type SingleRenderAdapter } from "./single-render.ts";
import { isFailedToolResult, registerToolResultMiddleware, type ToolResultEvent } from "./tool-result-middleware.ts";
import {
	ABORT_GRACE_MS,
	CHILD_DEPTH_ENV,
	assertCanDelegate,
	boundParallelOutput,
	boundTailOutput,
	cloneProgressResults,
	findNearestAgentsDirectory,
	getFinalAssistantText,
	mapWithConcurrencyLimit,
	MAX_CHAIN_STEPS,
	normalizeAgentMetadata,
	replacePreviousOutput,
	resolveWorkingDirectory,
	runChild,
	runSequentialChain,
	selectChildTools,
	type SpawnChild,
	validateDispatchMode,
} from "./runner.ts";

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

async function temporaryDirectory(): Promise<string> {
	return fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-test-"));
}

async function writeChildScript(directory: string, source: string): Promise<string> {
	const file = path.join(directory, "child.mjs");
	await fs.promises.writeFile(file, source, "utf8");
	return file;
}

function assistantEvent(stopReason = "end", text = "done"): string {
	return JSON.stringify({
		type: "message_end",
		message: { role: "assistant", content: [{ type: "text", text }], model: "test/model", stopReason, usage: { input: 10, output: 3, cacheRead: 2, cacheWrite: 1, totalTokens: 13, cost: { total: 0.25 } } },
	});
}

test("normalizes valid metadata and an inherited tool list", () => {
	assert.deepEqual(normalizeAgentMetadata({ name: " scout ", description: "Recon", model: "provider/model:low", tools: "read, grep, read" }), { name: " scout ", description: "Recon", model: "provider/model:low", tools: ["read", "grep", "read"] });
	assert.deepEqual(normalizeAgentMetadata({ name: "worker", description: "Work" }), { name: "worker", description: "Work", model: undefined, tools: undefined });
});

test("rejects malformed and wrongly typed frontmatter independently", () => {
	for (const metadata of [null, [], {}, { name: "", description: "x" }, { name: "x", description: 1 }, { name: "x", description: "y", model: {} }, { name: "x", description: "y", tools: ["read"] }]) assert.equal(normalizeAgentMetadata(metadata), null);
	assert.deepEqual(normalizeAgentMetadata({ name: "good", description: "still loaded", tools: "read" })?.tools, ["read"]);
});

test("finds only the nearest project agents directory", async () => {
	const root = await temporaryDirectory();
	try {
		const outer = path.join(root, ".pi", "agents"); const innerRoot = path.join(root, "a"); const inner = path.join(innerRoot, ".pi", "agents"); const cwd = path.join(innerRoot, "b", "c");
		await fs.promises.mkdir(outer, { recursive: true }); await fs.promises.mkdir(inner, { recursive: true }); await fs.promises.mkdir(cwd, { recursive: true });
		assert.equal(findNearestAgentsDirectory(cwd, ".pi"), inner); await fs.promises.rm(inner, { recursive: true }); assert.equal(findNearestAgentsDirectory(cwd, ".pi"), outer);
	} finally { await fs.promises.rm(root, { recursive: true, force: true }); }
});

test("resolves relative cwd and rejects missing or non-directory paths", async () => {
	const root = await temporaryDirectory();
	try {
		const nested = path.join(root, "nested"); const file = path.join(root, "file"); await fs.promises.mkdir(nested); await fs.promises.writeFile(file, "x");
		assert.equal(resolveWorkingDirectory(root, "nested"), nested); assert.equal(resolveWorkingDirectory(nested, ".."), root); assert.throws(() => resolveWorkingDirectory(root, "missing"), /does not exist or cannot be read/); assert.throws(() => resolveWorkingDirectory(root, "file"), /not a directory/);
	} finally { await fs.promises.rm(root, { recursive: true, force: true }); }
});

test("intersects requested tools with parent tools and removes every delegation tool", () => {
	assert.deepEqual(selectChildTools(["read", "bash", "subagent", "research", "oracle", "grep", "read"], ["read", "grep", "subagent", "research", "oracle"]), ["read", "grep"]);
	assert.deepEqual(selectChildTools(undefined, ["read", "subagent", "research", "oracle", "edit", "read"]), ["read", "edit"]);
});

type TestRenderNode = { kind: "text"; text: string } | { kind: "spacer" } | { kind: "markdown"; text: string } | { kind: "container"; children: TestRenderNode[] };
const testRenderAdapter: SingleRenderAdapter<TestRenderNode> = { text: (text) => ({ kind: "text", text }), spacer: () => ({ kind: "spacer" }), markdown: (text) => ({ kind: "markdown", text }), container: (children) => ({ kind: "container", children }) };
const testTheme = { fg: (_color: string, text: string) => text, bold: (text: string) => text };
function renderText(node: TestRenderNode): string { return node.kind === "container" ? node.children.map(renderText).join("\n") : node.kind === "spacer" ? "" : node.text; }
function renderMarkdown(node: TestRenderNode): string[] { return node.kind === "markdown" ? [node.text] : node.kind === "container" ? node.children.flatMap(renderMarkdown) : []; }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function singleRenderFixture(overrides: Record<string, unknown> = {}) { return { agent: "scout", agentSource: "project", task: "Inspect the cache invalidation design", messages: [{ role: "assistant", content: [{ type: "toolCall", name: "webfetch", arguments: { url: "https://example.com" } }, { type: "text", text: "## Answer\nUse explicit invalidation." }] }], status: "completed" as const, exitCode: 0, stderr: "", malformedStdout: "", usage: { input: 1_500, output: 250, cacheRead: 10, cacheWrite: 5, cost: 0.0123, contextTokens: 2_000, turns: 1 }, model: RESEARCH_MODEL, ...overrides }; }

test("one renderer handles generic and dedicated Research partial, final, and failure states without mutating details", () => {
	assert.deepEqual(renderDedicatedSingleCall("research", "x".repeat(61), testTheme, testRenderAdapter), { kind: "text", text: `research\n  ${"x".repeat(60)}...` });
	assert.deepEqual(renderGenericSingleCall("oracle", "user", "x", testTheme, testRenderAdapter), { kind: "text", text: "subagent oracle [user]\n  x" });
	const partial = singleRenderFixture({ agent: "researcher", agentSource: "user", status: "running", messages: [] }); const before = structuredClone(partial); deepFreeze(partial);
	assert.match(renderText(renderSingleResult(partial, { expanded: false, isPartial: true, failed: false, descriptor: { label: "research", showSource: false } }, testTheme, testRenderAdapter)), /\.\.\. research/); assert.deepEqual(partial, before);
	const final = singleRenderFixture({ agent: "researcher", agentSource: "user" });
	const collapsed = renderSingleResult(final, { expanded: false, isPartial: false, failed: false, descriptor: { label: "research", showSource: false } }, testTheme, testRenderAdapter);
	assert.match(renderText(collapsed), /ok research/); assert.doesNotMatch(renderText(collapsed), /\(user\)/); assert.match(renderText(collapsed), /webfetch/);
	const expanded = renderSingleResult(final, { expanded: true, isPartial: false, failed: false, descriptor: { label: "research", showSource: false } }, testTheme, testRenderAdapter); assert.match(renderText(expanded), /--- Task ---/); assert.deepEqual(renderMarkdown(expanded), ["## Answer\nUse explicit invalidation."]);
	const failed = renderSingleResult(singleRenderFixture({ status: "failed", messages: [], failureMessage: "Child stopped" }), { expanded: false, isPartial: false, failed: true, descriptor: { label: "research", showSource: false } }, testTheme, testRenderAdapter); assert.match(renderText(failed), /x research/); assert.match(renderText(failed), /Child stopped/);
});

test("failure middleware marks only Research and generic single failures as tool errors", () => {
	let handler: ((event: ToolResultEvent) => { isError: true } | undefined) | undefined; registerToolResultMiddleware({ on: (_event, registered) => (handler = registered) }); assert.ok(handler);
	assert.deepEqual(handler({ toolName: "research", details: { failed: true } }), { isError: true }); assert.deepEqual(handler({ toolName: "subagent", details: { mode: "single", failed: true } }), { isError: true }); assert.equal(handler({ toolName: "subagent", details: { mode: "parallel", failed: true } }), undefined); assert.equal(isFailedToolResult("oracle", { failed: true }), false);
});

test("validates exactly one bounded dispatch mode", () => {
	assert.deepEqual(validateDispatchMode({ agent: "scout", task: "inspect" }), { mode: "single" });
	assert.deepEqual(validateDispatchMode({ tasks: [{ agent: "scout", task: "inspect" }] }), { mode: "parallel" });
	assert.deepEqual(validateDispatchMode({ chain: [{ agent: "scout", task: "inspect" }] }), { mode: "chain" });
	assert.match(validateDispatchMode({}).error ?? "", /exactly one mode/);
	assert.match(validateDispatchMode({ agent: "scout", task: "inspect", tasks: [] }).error ?? "", /exactly one mode/);
	assert.match(validateDispatchMode({ tasks: [], chain: [] }).error ?? "", /exactly one mode/);
	assert.match(validateDispatchMode({ chain: [], agent: "scout", task: "inspect" }).error ?? "", /exactly one mode/);
	assert.match(validateDispatchMode({ tasks: [] }).error ?? "", /1 through 8/);
	assert.match(validateDispatchMode({ chain: [] }).error ?? "", /1 through 8/);
	assert.match(
		validateDispatchMode({ tasks: Array.from({ length: 9 }, () => ({ agent: "scout", task: "inspect" })) }).error ?? "",
		/Max is 8/,
	);
	assert.match(
		validateDispatchMode({ chain: Array.from({ length: MAX_CHAIN_STEPS + 1 }, () => ({ agent: "scout", task: "inspect" })) })
			.error ?? "",
		/Max is 8/,
	);
	assert.match(validateDispatchMode({ agent: "scout" }).error ?? "", /requires non-empty agent and task/);
});

test("registered generic subagent executes single, parallel, and chain modes", async () => {
	const root = await temporaryDirectory();
	const agentsDir = path.join(root, ".pi", "agents");
	const script = await writeChildScript(
		root,
		`let stdin = ""; for await (const chunk of process.stdin) stdin += chunk; const task = stdin.slice("Task: ".length); console.log(JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "child:" + task }], stopReason: "end", usage: {} } }));`,
	);
	try {
		await fs.promises.mkdir(agentsDir, { recursive: true });
		await fs.promises.writeFile(path.join(agentsDir, "test-worker.md"), "---\nname: test-worker\ndescription: Test worker\ntools: read\n---\n\nComplete the task.\n");
		const registered: Array<{ name: string; execute: (...args: any[]) => Promise<any> }> = [];
		const { registerSubagentExtension } = await import("./index.ts");
		registerSubagentExtension({
			registerTool(tool: { name: string; execute: (...args: any[]) => Promise<any> }) { registered.push(tool); },
			on() {},
			getActiveTools() { return ["read"]; },
		} as never);
		const subagent = registered.find((tool) => tool.name === "subagent");
		assert.ok(subagent);
		const originalArgv = process.argv[1];
		try {
			process.argv[1] = script;
			const context = { cwd: root, model: undefined, thinkingLevel: undefined, hasUI: false };
			const execute = (params: unknown) => subagent.execute("call", params, new AbortController().signal, undefined, context);

			const single = await execute({ agent: "test-worker", task: "single", agentScope: "project", confirmProjectAgents: false });
			assert.equal(single.content[0].text, "child:single");
			assert.equal(single.details.mode, "single");
			assert.equal(single.details.results[0].status, "completed");

			const parallel = await execute({ tasks: [{ agent: "test-worker", task: "first" }, { agent: "test-worker", task: "second" }], agentScope: "project", confirmProjectAgents: false });
			assert.match(parallel.content[0].text, /Parallel: 2\/2 succeeded/);
			assert.match(parallel.content[0].text, /child:first/);
			assert.match(parallel.content[0].text, /child:second/);
			assert.equal(parallel.details.mode, "parallel");
			assert.deepEqual(parallel.details.results.map((result: { status: string }) => result.status), ["completed", "completed"]);

			const chain = await execute({ chain: [{ agent: "test-worker", task: "seed" }, { agent: "test-worker", task: "follow {previous}" }], agentScope: "project", confirmProjectAgents: false });
			assert.equal(chain.content[0].text, "child:follow child:seed");
			assert.equal(chain.details.mode, "chain");
			assert.equal(chain.details.results[1].task, "follow child:seed");
		} finally {
			process.argv[1] = originalArgv;
		}
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("uses only the final assistant message, including a genuinely empty output", () => {
	assert.equal(
		getFinalAssistantText([
			{ role: "assistant", content: [{ type: "text", text: "stale" }] },
			{ role: "toolResult", content: [{ type: "text", text: "tool" }] },
			{ role: "assistant", content: [{ type: "toolCall", name: "read" }] },
		]),
		"",
	);
	assert.equal(
		getFinalAssistantText([
			{ role: "assistant", content: [{ type: "text", text: "old" }] },
			{ role: "assistant", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] },
		]),
		"ab",
	);
});

test("runs chain steps sequentially with global immediate-output replacement, including empty output", async () => {
	const steps = [
		{ task: "first" },
		{ task: "second sees {previous} and again {previous}" },
		{ task: "third sees [{previous}]" },
	];
	const calls: Array<{ index: number; task: string; completed: number }> = [];
	let active = 0;
	const execution = await runSequentialChain(
		steps,
		async (_step, resolvedTask, index, completed) => {
			active++;
			assert.equal(active, 1);
			calls.push({ index, task: resolvedTask, completed: completed.length });
			await Promise.resolve();
			active--;
			return { failed: false, output: index === 0 ? "alpha" : "" };
		},
		(result) => result.failed,
		(result) => result.output,
	);
	assert.equal(execution.failedIndex, undefined);
	assert.equal(execution.results.length, 3);
	assert.deepEqual(calls, [
		{ index: 0, task: "first", completed: 0 },
		{ index: 1, task: "second sees alpha and again alpha", completed: 1 },
		{ index: 2, task: "third sees []", completed: 2 },
	]);
	assert.equal(replacePreviousOutput("{previous}/{previous}", "x"), "x/x");
});

test("stops a chain at the first failure and preserves attempted results", async () => {
	const calls: number[] = [];
	const execution = await runSequentialChain(
		Array.from({ length: MAX_CHAIN_STEPS }, (_, index) => ({ task: `step ${index}: {previous}` })),
		async (_step, _resolvedTask, index) => {
			calls.push(index);
			return { failed: index === 2, output: `output-${index}` };
		},
		(result) => result.failed,
		(result) => result.output,
	);
	assert.deepEqual(calls, [0, 1, 2]);
	assert.equal(execution.failedIndex, 2);
	assert.deepEqual(execution.results.map((result) => result.output), ["output-0", "output-1", "output-2"]);
});

test("parallel scheduling caps concurrency, preserves order, and isolates progress snapshots", async () => {
	let active = 0;
	let maximumActive = 0;
	const completions: number[] = [];
	const results = await mapWithConcurrencyLimit([0, 1, 2, 3, 4, 5], 4, async (item) => {
		active++;
		maximumActive = Math.max(maximumActive, active);
		await new Promise((resolve) => setTimeout(resolve, (6 - item) * 2));
		active--;
		completions.push(item);
		return item === 2 ? `failed-${item}` : `completed-${item}`;
	});
	assert.equal(maximumActive, 4);
	assert.notDeepEqual(completions, [0, 1, 2, 3, 4, 5]);
	assert.deepEqual(results, ["completed-0", "completed-1", "failed-2", "completed-3", "completed-4", "completed-5"]);

	const live = [{ status: "queued", messages: [{ text: "first" }] }];
	const snapshot = cloneProgressResults(live);
	live[0].status = "running";
	live[0].messages[0].text = "changed";
	assert.deepEqual(snapshot, [{ status: "queued", messages: [{ text: "first" }] }]);
});

test("parallel sections share one bounded output budget while retaining every status header", () => {
	const maxLines = 100;
	const maxBytes = 4_000;
	const truncate = (value: string, limits: { maxLines: number; maxBytes: number }) => {
		const allLines = value.split("\n");
		let content = allLines.slice(-limits.maxLines).join("\n");
		while (Buffer.byteLength(content, "utf8") > limits.maxBytes) content = content.slice(1);
		return {
			content,
			truncated: content !== value,
			totalLines: allLines.length,
			totalBytes: Buffer.byteLength(value, "utf8"),
		};
	};
	const sections = Array.from({ length: 8 }, (_, index) => ({
		header: `### Task ${index + 1}: [agent-${index + 1}] ${index === 3 ? "failed" : "completed"}`,
		output: Array.from({ length: 200 }, (__, line) => `task ${index + 1} line ${line} ${"x".repeat(30)}`).join("\n"),
	}));
	const output = boundParallelOutput("Parallel: 7/8 succeeded", sections, { maxLines, maxBytes }, truncate, (bytes) => `${bytes}B`);
	assert.ok(output.split("\n").length <= maxLines);
	assert.ok(Buffer.byteLength(output, "utf8") <= maxBytes);
	for (let index = 1; index <= 8; index++) assert.match(output, new RegExp(`### Task ${index}:`));
	assert.match(output, /Task 4: \[agent-4\] failed/);
	assert.match(output, /Full messages remain in tool details/);
});

test("keeps chain progress and failure identity inside one output budget", () => {
	const maxLines = 60;
	const maxBytes = 2_000;
	const truncate = (value: string, limits: { maxLines: number; maxBytes: number }) => {
		const allLines = value.split("\n");
		let content = allLines.slice(-limits.maxLines).join("\n");
		while (Buffer.byteLength(content, "utf8") > limits.maxBytes) content = content.slice(1);
		return {
			content,
			truncated: content !== value,
			totalLines: allLines.length,
			totalBytes: Buffer.byteLength(value, "utf8"),
		};
	};
	for (const aggregateHeader of ["Chain: step 2/8 running", "Chain failed at step 2/8 (planner)"]) {
		const output = boundParallelOutput(
			aggregateHeader,
			[
				{
					header: "### Step 2: [planner] failed",
					output: Array.from({ length: 200 }, (_, index) => `diagnostic ${index} ${"x".repeat(40)}`).join("\n"),
				},
			],
			{ maxLines, maxBytes },
			truncate,
			(bytes) => `${bytes}B`,
		);
		assert.ok(output.split("\n").length <= maxLines);
		assert.ok(Buffer.byteLength(output, "utf8") <= maxBytes);
		assert.match(output, new RegExp(aggregateHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.match(output, /Step 2: \[planner\]/);
	}
});

test("keeps the truncation notice inside the total line and byte limits", () => {
	const maxLines = 20;
	const maxBytes = 300;
	const source = Array.from({ length: 40 }, (_, index) => `line ${index}: ${"x".repeat(30)}`).join("\n");
	const truncate = (value: string, limits: { maxLines: number; maxBytes: number }) => {
		const allLines = value.split("\n");
		let content = allLines.slice(-limits.maxLines).join("\n");
		while (Buffer.byteLength(content, "utf8") > limits.maxBytes) content = content.slice(1);
		return {
			content,
			truncated: content !== value,
			totalLines: allLines.length,
			totalBytes: Buffer.byteLength(value, "utf8"),
		};
	};
	const output = boundTailOutput(source, { maxLines, maxBytes }, truncate, (bytes) => `${bytes}B`);
	assert.ok(output.split("\n").length <= maxLines);
	assert.ok(Buffer.byteLength(output, "utf8") <= maxBytes);
	assert.match(output, /\[Subagent output truncated:/);
	assert.ok(output.endsWith("Full messages remain in tool details.]"));
});

test("rejects nested delegation from the depth marker", () => {
	assert.throws(() => assertCanDelegate({ [CHILD_DEPTH_ENV]: "1" }), /Nested subagent delegation is disabled/);
	assert.doesNotThrow(() => assertCanDelegate({}));
});

test("sends the task only through stdin and sets child cwd and depth", async () => {
	const root = await temporaryDirectory();
	try {
		const recordPath = path.join(root, "record.json");
		const script = await writeChildScript(
			root,
			`import fs from "node:fs";
let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) stdin += chunk;
fs.writeFileSync(process.argv[2], JSON.stringify({ args: process.argv.slice(3), stdin, cwd: process.cwd(), depth: process.env.${CHILD_DEPTH_ENV} }));
console.log(${JSON.stringify(assistantEvent())});
`,
		);
		const task = "secret task with spaces";
		const result = await runChild({
			command: process.execPath,
			args: [script, recordPath, "--mode", "json", "--no-tools"],
			task,
			cwd: root,
		});
		const record = JSON.parse(await fs.promises.readFile(recordPath, "utf8"));
		assert.deepEqual(record, {
			args: ["--mode", "json", "--no-tools"],
			stdin: `Task: ${task}`,
			cwd: await fs.promises.realpath(root),
			depth: "1",
		});
		assert.equal(JSON.stringify(record.args).includes(task), false);
		assert.equal(result.exitCode, 0);
		assert.equal(result.failureMessage, undefined);
		assert.equal(result.messages.length, 1);
		assert.deepEqual(result.usage, {
			input: 10,
			output: 3,
			cacheRead: 2,
			cacheWrite: 1,
			cost: 0.25,
			contextTokens: 13,
			turns: 1,
		});
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("ignores unrelated events, retains malformed lines, and emits immutable snapshots", async () => {
	const root = await temporaryDirectory();
	try {
		const first = assistantEvent("end", "first");
		const second = JSON.stringify({
			type: "tool_result_end",
			message: { role: "toolResult", content: [{ type: "text", text: "tool output" }] },
		});
		const script = await writeChildScript(
			root,
			`process.stdin.resume();
process.stdin.on("end", () => {
  console.log("not json");
  console.log(JSON.stringify({ type: "message_end", message: { role: 7, content: [] } }));
  console.log(${JSON.stringify(first)});
  console.log(${JSON.stringify(second)});
});
`,
		);
		const snapshots: Awaited<ReturnType<typeof runChild>>[] = [];
		const result = await runChild({
			command: process.execPath,
			args: [script],
			task: "test",
			cwd: root,
			onUpdate: (snapshot) => snapshots.push(snapshot),
		});
		assert.equal(result.failureMessage, undefined);
		assert.match(result.malformedStdout, /not json/);
		assert.equal(result.messages.length, 2);
		assert.equal(snapshots.length, 2);
		assert.equal(snapshots[0].messages.length, 1);
		assert.equal(snapshots[1].messages.length, 2);
		result.messages[0].content[0].text = "mutated";
		assert.equal(snapshots[0].messages[0].content[0].text, "first");
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("classifies model error, aborted, and length stop reasons as failures", async () => {
	const root = await temporaryDirectory();
	try {
		for (const reason of ["error", "aborted", "length"]) {
			const script = await writeChildScript(root, `process.stdin.resume(); process.stdin.on("end", () => console.log(${JSON.stringify(assistantEvent(reason))}));`);
			const result = await runChild({ command: process.execPath, args: [script], task: reason, cwd: root });
			assert.match(result.failureMessage ?? "", new RegExp(`reason ${reason}`));
		}
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("classifies non-JSON-only stdout and nonzero exits", async () => {
	const root = await temporaryDirectory();
	try {
		const script = await writeChildScript(root, `process.stdin.resume(); process.stdin.on("end", () => { console.log("plain output"); process.exitCode = 7; });`);
		const result = await runChild({ command: process.execPath, args: [script], task: "test", cwd: root });
		assert.equal(result.exitCode, 7);
		assert.match(result.failureMessage ?? "", /code 7/);
		assert.match(result.malformedStdout, /plain output/);
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("reports spawn errors without throwing", async () => {
	const root = await temporaryDirectory();
	try {
		const result = await runChild({ command: path.join(root, "missing-command"), args: [], task: "test", cwd: root });
		assert.equal(result.exitCode, 1);
		assert.match(result.failureMessage ?? "", /spawn or communicate|spawn subagent/);
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

class FakeStream extends EventEmitter {
	input = "";
	end(data = "") {
		this.input += data;
	}
}

class FakeChild extends EventEmitter {
	stdin = new FakeStream();
	stdout = new FakeStream();
	stderr = new FakeStream();
	kills: NodeJS.Signals[] = [];

	kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
		this.kills.push(signal);
		if (signal === "SIGKILL") queueMicrotask(() => this.emit("close", null, "SIGKILL"));
		return true;
	}
}

test("a pre-aborted child does not spawn", async () => {
	const controller = new AbortController();
	controller.abort();
	let spawned = false;
	const result = await runChild({
		command: "fake",
		args: [],
		task: "do not run",
		cwd: process.cwd(),
		signal: controller.signal,
		spawn: (() => {
			spawned = true;
			return new FakeChild();
		}) as SpawnChild,
	});
	assert.equal(spawned, false);
	assert.equal(result.exitCode, 1);
	assert.match(result.failureMessage ?? "", /aborted before spawn/);
});

test("abort escalates from SIGTERM to SIGKILL and cleans up timer and listener", async () => {
	const child = new FakeChild();
	const spawn: SpawnChild = () => child;
	const controller = new AbortController();
	const signal = controller.signal;
	const add = signal.addEventListener.bind(signal);
	const remove = signal.removeEventListener.bind(signal);
	let additions = 0;
	let removals = 0;
	signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => {
		if (args[0] === "abort") additions++;
		return add(...args);
	}) as AbortSignal["addEventListener"];
	signal.removeEventListener = ((...args: Parameters<AbortSignal["removeEventListener"]>) => {
		if (args[0] === "abort") removals++;
		return remove(...args);
	}) as AbortSignal["removeEventListener"];
	let timerCallback: (() => void) | undefined;
	let scheduledDelay: number | undefined;
	let cleared = 0;
	const promise = runChild({
		command: "fake",
		args: [],
		task: "abort me",
		cwd: process.cwd(),
		signal,
		spawn,
		setTimeout: ((callback: () => void, delay: number) => {
			timerCallback = callback;
			scheduledDelay = delay;
			return 1 as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout,
		clearTimeout: (() => {
			cleared++;
		}) as typeof clearTimeout,
	});
	controller.abort();
	assert.deepEqual(child.kills, ["SIGTERM"]);
	assert.equal(scheduledDelay, ABORT_GRACE_MS);
	assert.ok(timerCallback);
	timerCallback();
	const result = await promise;
	assert.deepEqual(child.kills, ["SIGTERM", "SIGKILL"]);
	assert.equal(result.signal, "SIGKILL");
	assert.match(result.failureMessage ?? "", /aborted/);
	assert.equal(cleared, 1);
	assert.equal(additions, 1);
	assert.equal(removals, 1);
});
