import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerResearchBoundary, ResearchBoundaryTracker } from "../../../.pi/agent/extensions/subagent/research-boundary.ts";

// Import after setting capture configuration because the extension deliberately
// rejects a missing audit destination.
test("terminal capture records the exact fake-provider payload after a later mutator and terminal replacement", async () => {
	const directory = await mkdtemp(join(tmpdir(), "task02-capture-"));
	const captureFile = join(directory, "capture.jsonl");
	process.env.TASK02_CAPTURE_FILE = captureFile;
	process.env.TASK02_PHASE = "fake";
	const { registerTerminalCapture } = await import("./capture-extension.ts");
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	let active: any;
	const pi = {
		on(event: string, handler: (event: any, ctx: any) => any) {
			const registered = handlers.get(event) ?? [];
			registered.push(handler);
			handlers.set(event, registered);
		},
		registerProvider(provider: unknown) { active = provider; },
	};
	const marker = "task02-fake-private-marker";
	const synthesis = "bounded fake synthesis";
	const transport: unknown[] = [];
	const model = { id: "fake", provider: "fake-provider", api: "openai-responses" } as never;
	const base = {
		id: "fake-provider",
		stream(_model: unknown, _context: unknown, options: any) {
			return (async () => {
				const initial = { model: "fake", input: [
					{ type: "function_call", call_id: "research-call", name: "research", arguments: "{}" },
					{ type: "function_call_output", call_id: "research-call", output: synthesis },
				] };
				const payload = await options.onPayload(initial, model);
				transport.push(payload);
				return payload;
			})();
		},
	};
	active = base;
	const context = { model, modelRegistry: { getProvider: () => active } };
	registerTerminalCapture(pi as never);
	const tracker = new ResearchBoundaryTracker();
	registerResearchBoundary(pi as never, tracker);
	for (const handler of handlers.get("session_start") ?? []) handler({}, context);
	tracker.record({
		content: [{ type: "text", text: synthesis }],
		details: { results: [{ messages: [
			{ role: "toolResult", toolCallId: "private-fetch", toolName: "webfetch", content: [{ type: "text", text: marker }] },
			{ role: "assistant", content: [{ type: "text", text: synthesis }] },
		] }] },
	}, "research-call");
	tracker.inspectContext([{ role: "toolResult", toolName: "research", toolCallId: "research-call", content: [{ type: "text", text: synthesis }] }] as never);
	await active.stream(model, {} as never, {
		onPayload(payload: any) {
			return { ...payload, laterMutator: marker };
		},
	});
	assert.equal(transport.length, 1);
	assert.equal(JSON.stringify(transport[0]).includes(marker), false);
	assert.equal(JSON.stringify(transport[0]).includes("Research isolation failure"), true);
	const records = (await readFile(captureFile, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
	const terminal = records.filter((record) => record.kind === "terminal_transport_payload");
	assert.equal(terminal.length, 1);
	assert.deepEqual(terminal[0].value.payload, transport[0]);
});
