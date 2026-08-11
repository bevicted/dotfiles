import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
	ABORT_GRACE_MS,
	CHILD_DEPTH_ENV,
	assertCanDelegate,
	boundParallelOutput,
	boundTailOutput,
	cloneProgressResults,
	findNearestAgentsDirectory,
	mapWithConcurrencyLimit,
	normalizeAgentMetadata,
	resolveWorkingDirectory,
	runChild,
	selectChildTools,
	type SpawnChild,
	validateDispatchMode,
} from "./runner.ts";

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
		message: {
			role: "assistant",
			content: [{ type: "text", text }],
			model: "test/model",
			stopReason,
			usage: {
				input: 10,
				output: 3,
				cacheRead: 2,
				cacheWrite: 1,
				totalTokens: 13,
				cost: { total: 0.25 },
			},
		},
	});
}

test("normalizes valid metadata and an inherited tool list", () => {
	assert.deepEqual(
		normalizeAgentMetadata({
			name: " scout ",
			description: "Recon",
			model: "provider/model:low",
			tools: "read, grep, read",
		}),
		{
			name: " scout ",
			description: "Recon",
			model: "provider/model:low",
			tools: ["read", "grep", "read"],
		},
	);
	assert.deepEqual(normalizeAgentMetadata({ name: "worker", description: "Work" }), {
		name: "worker",
		description: "Work",
		model: undefined,
		tools: undefined,
	});
});

test("rejects malformed and wrongly typed frontmatter independently", () => {
	for (const metadata of [
		null,
		[],
		{},
		{ name: "", description: "x" },
		{ name: "x", description: 1 },
		{ name: "x", description: "y", model: {} },
		{ name: "x", description: "y", tools: ["read"] },
	]) {
		assert.equal(normalizeAgentMetadata(metadata), null);
	}
	assert.deepEqual(normalizeAgentMetadata({ name: "good", description: "still loaded", tools: "read" })?.tools, ["read"]);
});

test("finds only the nearest project agents directory", async () => {
	const root = await temporaryDirectory();
	try {
		const outer = path.join(root, ".pi", "agents");
		const innerRoot = path.join(root, "a");
		const inner = path.join(innerRoot, ".pi", "agents");
		const cwd = path.join(innerRoot, "b", "c");
		await fs.promises.mkdir(outer, { recursive: true });
		await fs.promises.mkdir(inner, { recursive: true });
		await fs.promises.mkdir(cwd, { recursive: true });
		assert.equal(findNearestAgentsDirectory(cwd, ".pi"), inner);
		await fs.promises.rm(inner, { recursive: true });
		assert.equal(findNearestAgentsDirectory(cwd, ".pi"), outer);
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("resolves relative cwd and rejects missing or non-directory paths", async () => {
	const root = await temporaryDirectory();
	try {
		const nested = path.join(root, "nested");
		const file = path.join(root, "file");
		await fs.promises.mkdir(nested);
		await fs.promises.writeFile(file, "x");
		assert.equal(resolveWorkingDirectory(root, "nested"), nested);
		assert.equal(resolveWorkingDirectory(nested, ".."), root);
		assert.throws(() => resolveWorkingDirectory(root, "missing"), /does not exist or cannot be read/);
		assert.throws(() => resolveWorkingDirectory(root, "file"), /not a directory/);
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

test("intersects requested tools with parent tools and always removes subagent", () => {
	assert.deepEqual(selectChildTools(["read", "bash", "subagent", "read"], ["read", "grep", "subagent"]), ["read"]);
	assert.deepEqual(selectChildTools(undefined, ["read", "subagent", "edit"]), ["read", "edit"]);
	assert.deepEqual(selectChildTools(["bash"], ["read", "subagent"]), []);
});

test("validates exactly one bounded dispatch mode", () => {
	assert.deepEqual(validateDispatchMode({ agent: "scout", task: "inspect" }), { mode: "single" });
	assert.deepEqual(validateDispatchMode({ tasks: [{ agent: "scout", task: "inspect" }] }), { mode: "parallel" });
	assert.match(validateDispatchMode({}).error ?? "", /exactly one mode/);
	assert.match(validateDispatchMode({ agent: "scout", task: "inspect", tasks: [] }).error ?? "", /exactly one mode/);
	assert.match(validateDispatchMode({ tasks: [] }).error ?? "", /1 through 8/);
	assert.match(
		validateDispatchMode({ tasks: Array.from({ length: 9 }, () => ({ agent: "scout", task: "inspect" })) }).error ?? "",
		/Max is 8/,
	);
	assert.match(validateDispatchMode({ agent: "scout" }).error ?? "", /requires non-empty agent and task/);
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

test("the tracked agent definitions have the approved model and tool matrix", async () => {
	const agentsDir = path.resolve(".pi/agent/agents");
	const files = (await fs.promises.readdir(agentsDir)).filter((file) => file.endsWith(".md")).sort();
	assert.deepEqual(files, ["planner.md", "reviewer.md", "scout.md", "worker.md"]);
	const expected = {
		"planner.md": { model: "openai-codex/gpt-5.6-sol:high", tools: "read, grep, find, ls" },
		"reviewer.md": { model: "openai-codex/gpt-5.6-terra:high", tools: "read, grep, find, ls" },
		"scout.md": { model: "openai-codex/gpt-5.6-terra:low", tools: "read, grep, find, ls" },
		"worker.md": { model: "openai-codex/gpt-5.6-terra:high", tools: undefined },
	} as const;
	for (const file of files) {
		const content = await fs.promises.readFile(path.join(agentsDir, file), "utf8");
		assert.match(content, new RegExp(`^model: ${expected[file as keyof typeof expected].model}$`, "m"));
		const tools = content.match(/^tools: (.+)$/m)?.[1];
		assert.equal(tools, expected[file as keyof typeof expected].tools);
	}
	assert.doesNotMatch(await fs.promises.readFile(path.join(agentsDir, "reviewer.md"), "utf8"), /\bbash\b/i);
	assert.match(await fs.promises.readFile(path.join(agentsDir, "worker.md"), "utf8"), /Do not delegate to subagents/);
});
