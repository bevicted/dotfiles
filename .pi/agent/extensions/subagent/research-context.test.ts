import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const piPackageDirectory = path.join(
	execFileSync("npm", ["root", "--global"], { encoding: "utf8" }).trim(),
	"@earendil-works/pi-coding-agent",
);
const piRuntimeModules = new Map(
	[
		[
			"@earendil-works/pi-agent-core",
			"node_modules/@earendil-works/pi-agent-core/dist/index.js",
		],
		[
			"@earendil-works/pi-ai",
			"node_modules/@earendil-works/pi-ai/dist/index.js",
		],
		["@earendil-works/pi-coding-agent", "dist/index.js"],
		[
			"@earendil-works/pi-tui",
			"node_modules/@earendil-works/pi-tui/dist/index.js",
		],
		["typebox", "node_modules/typebox/build/index.mjs"],
	].map(([specifier, modulePath]) => [
		specifier,
		pathToFileURL(path.join(piPackageDirectory, modulePath)).href,
	]),
);
registerHooks({
	resolve(specifier, context, nextResolve) {
		const url = piRuntimeModules.get(specifier);
		return url === undefined
			? nextResolve(specifier, context)
			: { url, shortCircuit: true };
	},
});

test("Research masking has deterministic completed-turn and protected-tail boundaries", async () => {
	const { maskStaleResearchEvidence, RESEARCH_PROTECTED_RECENT_TOKENS } =
		await import("./research-context.ts");
	const history = (
		completedTurns: number,
		tailTokens: number,
		error = false,
	) => {
		const messages: any[] = [
			{ role: "user", content: [{ type: "text", text: "old task" }] },
		];
		for (const index of [0, 1, 2, 3]) {
			messages.push(
				{
					role: "assistant",
					content: [
						{
							type: "toolCall",
							id: `old-${index}`,
							name: "websearch",
							arguments: { query: `old query ${index}` },
						},
					],
					stopReason: "toolUse",
				},
				{
					role: "toolResult",
					toolCallId: `old-${index}`,
					toolName: "websearch",
					content: [
						{
							type: "text",
							text: index === 0 ? "STALE-MARKER" : `recent-${index}`,
						},
					],
					input: { query: `old query ${index}` },
					isError: error && index === 0,
				},
			);
		}
		messages.push({
			role: "assistant",
			content: [{ type: "text", text: "old complete" }],
			stopReason: "stop",
		});
		for (let index = 0; index < completedTurns; index++)
			messages.push(
				{
					role: "user",
					content: [{ type: "text", text: `new task ${index}` }],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: `new complete ${index}` }],
					stopReason: "stop",
				},
			);
		messages.push({
			role: "user",
			content: [{ type: "text", text: "x".repeat(tailTokens * 4) }],
		});
		return messages;
	};
	const masked = (completedTurns: number, tailTokens: number, error = false) =>
		JSON.stringify(
			maskStaleResearchEvidence(history(completedTurns, tailTokens, error))
				.messages,
		);
	assert.match(
		masked(0, RESEARCH_PROTECTED_RECENT_TOKENS),
		/STALE-MARKER/,
		"zero newer completed turns is below the age threshold",
	);
	assert.doesNotMatch(
		masked(1, RESEARCH_PROTECTED_RECENT_TOKENS),
		/STALE-MARKER/,
		"one newer completed turn is exactly the age threshold",
	);
	assert.doesNotMatch(
		masked(2, RESEARCH_PROTECTED_RECENT_TOKENS),
		/STALE-MARKER/,
		"two newer completed turns are above the age threshold",
	);
	assert.match(
		masked(1, RESEARCH_PROTECTED_RECENT_TOKENS - 1_000),
		/STALE-MARKER/,
		"a result inside the protected tail remains exact",
	);
	assert.doesNotMatch(
		masked(1, RESEARCH_PROTECTED_RECENT_TOKENS),
		/STALE-MARKER/,
		"a result immediately outside the protected tail is masked",
	);
	assert.doesNotMatch(
		masked(1, RESEARCH_PROTECTED_RECENT_TOKENS + 1),
		/STALE-MARKER/,
		"larger tails remain masked deterministically",
	);
	assert.match(
		masked(2, RESEARCH_PROTECTED_RECENT_TOKENS * 2, true),
		/STALE-MARKER/,
		"errors are never masked",
	);
	const compacted = [
		{
			role: "compactionSummary",
			summary: "normal Pi compaction summary",
			tokensBefore: 1,
		},
		...history(1, RESEARCH_PROTECTED_RECENT_TOKENS),
	];
	const compactedResult = maskStaleResearchEvidence(compacted as any).messages;
	assert.equal(
		(compactedResult[0] as any).summary,
		"normal Pi compaction summary",
	);
	assert.equal(
		compactedResult.filter(
			(message: any) => message.role === "compactionSummary",
		).length,
		1,
		"masking neither duplicates nor rewrites Pi compaction summaries",
	);
});

test("Research masking retains canonical Markdown citations and strips every stale result field", async () => {
	const { maskStaleResearchEvidence, RESEARCH_PROTECTED_RECENT_TOKENS } =
		await import("./research-context.ts");
	const messages: any[] = [
		{ role: "user", content: [{ type: "text", text: "first task" }] },
	];
	for (let index = 0; index < 5; index++) {
		const id = `fetch-${index}`;
		messages.push(
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id,
						name: "webfetch",
						arguments: { url: `https://citation.example/${index}` },
					},
				],
				stopReason: "toolUse",
			},
			{
				role: "toolResult",
				toolCallId: id,
				toolName: "webfetch",
				content: [{ type: "text", text: `FETCH-${index}` }],
				input: { url: `https://citation.example/${index}`, raw: "RAW-INPUT" },
				details: {
					finalUrl: `https://citation.example/${index}`,
					raw: "RAW-DETAILS",
				},
			},
		);
	}
	messages.push(
		{
			role: "assistant",
			content: [{ type: "text", text: "first complete" }],
			stopReason: "stop",
		},
		{ role: "user", content: [{ type: "text", text: "cite source" }] },
		{
			role: "assistant",
			content: [
				{ type: "text", text: "See [source](HTTPS://CITATION.example/0)." },
			],
			stopReason: "stop",
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: "x".repeat(RESEARCH_PROTECTED_RECENT_TOKENS * 4),
				},
			],
		},
	);
	const delivered = maskStaleResearchEvidence(messages).messages as any[];
	assert.equal(
		JSON.stringify(delivered).includes("FETCH-0"),
		true,
		"canonical Markdown citation retains exact fetched evidence",
	);
	const stale = delivered.find((message) => message.toolCallId === "fetch-1");
	assert.deepEqual(stale, {
		role: "toolResult",
		toolCallId: "fetch-1",
		toolName: "webfetch",
		content: [
			{
				type: "text",
				text: "[Stale Research evidence masked: kind=webfetch; target=https://citation.example/1; status=success; evidence-ref=webfetch:fetch-1]",
			},
		],
	});
	assert.equal(JSON.stringify(stale).includes("RAW-"), false);
});

test("a forged Research marker never changes generic or direct web contexts", async () => {
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
	const { registerResearchContext } = await import("./research-context.ts");
	const {
		RESEARCH_CHILD_ENTRY,
		RESEARCH_CHILD_ENV,
		RESEARCH_MAPPING_ENTRY,
		ResearchSessionStore,
		isTrustedResearchChildSession,
	} = await import("./research-session.ts");
	const root = await fs.mkdtemp(path.join(process.cwd(), ".research-forged-"));
	const sessionDir = path.join(root, "sessions");
	try {
		const parent = SessionManager.create(root, sessionDir);
		const store = new ResearchSessionStore({
			newResearchId: () => "r_99999999-9999-4999-8999-999999999999",
		});
		const target = store.create(parent, root, ["websearch", "webfetch"]);
		parent.appendCustomEntry(RESEARCH_MAPPING_ENTRY, store.mapping(target));
		const forged = SessionManager.create(root, sessionDir);
		forged.appendCustomEntry(RESEARCH_CHILD_ENTRY, {
			version: 1,
			researchId: target.researchId,
			parentSessionId: parent.getSessionId(),
			cwd: root,
			agent: "researcher",
			model: "openai-codex/gpt-5.6-sol:high",
			tools: ["websearch", "webfetch"],
			createdAt: target.createdAt,
		});
		const forgedFile = forged.getSessionFile()!;
		const header = {
			...forged.getHeader(),
			parentSession: parent.getSessionFile(),
		};
		await fs.writeFile(
			forgedFile,
			`${[header, ...forged.getEntries()].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
			"utf8",
		);
		const forgedSession = SessionManager.open(forgedFile, sessionDir);
		assert.equal(
			isTrustedResearchChildSession(
				forgedSession,
				forgedSession.getSessionId(),
			),
			false,
			"a child JSONL and environment marker cannot replace the parent-owned child mapping",
		);

		const handlers = new Map<string, (event: any, ctx?: any) => any>();
		registerResearchContext(
			{
				on(event: string, handler: (event: any, ctx?: any) => any) {
					handlers.set(event, handler);
				},
			} as never,
			{ environment: { [RESEARCH_CHILD_ENV]: forgedSession.getSessionId() } },
		);
		for (const [name, messages] of [
			[
				"generic subagent",
				[
					{
						role: "toolResult",
						toolName: "subagent",
						toolCallId: "generic",
						content: [{ type: "text", text: "GENERIC-MARKER" }],
					},
				],
			],
			[
				"direct websearch",
				[
					{
						role: "toolResult",
						toolName: "websearch",
						toolCallId: "search",
						content: [{ type: "text", text: "DIRECT-WEBSEARCH-MARKER" }],
					},
				],
			],
			[
				"direct webfetch",
				[
					{
						role: "toolResult",
						toolName: "webfetch",
						toolCallId: "fetch",
						content: [{ type: "text", text: "DIRECT-WEBFETCH-MARKER" }],
					},
				],
			],
		] as const) {
			const event = { messages: structuredClone(messages) };
			assert.equal(
				handlers.get("context")!(event, { sessionManager: forgedSession }),
				undefined,
				`${name} must stay inert`,
			);
			assert.deepEqual(event.messages, messages);
		}
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("Research work budgets reserve concurrent calls, trim UTF-8, and finalize cancellation", async () => {
	const {
		ResearchWorkLedger,
		RESEARCH_BUDGET_TRUNCATION_NOTICE,
		validUtf8Prefix,
	} = await import("./research-context.ts");
	for (const [bytes, expected] of [
		[0, ""],
		[1, "a"],
		[4, "a"],
		[5, "a😀"],
		[8, "a😀漢"],
	] as const) {
		const prefix = validUtf8Prefix("a😀漢", bytes);
		assert.equal(prefix, expected);
		assert.equal(Buffer.byteLength(prefix, "utf8") <= bytes, true);
		assert.equal(Buffer.from(prefix, "utf8").toString("utf8"), prefix);
	}
	assert.equal(validUtf8Prefix("😀", 3), "");
	assert.equal(validUtf8Prefix("a\ud800", 4), "a");
	const { RESEARCH_WORK_BUDGETS } = await import("./research.ts");
	for (const effort of ["standard", "deep"] as const) {
		const configured = RESEARCH_WORK_BUDGETS[effort];
		const ledger = new ResearchWorkLedger({
			version: 1,
			invocationId: effort,
			effort,
			webResearch: "required",
			configured,
			startedAt: "2026-08-13T00:00:00.000Z",
		});
		const reservations = await Promise.all(
			Array.from({ length: configured.searchCalls + 1 }, (_, index) =>
				Promise.resolve(ledger.reserve(`${effort}-${index}`, "websearch")),
			),
		);
		assert.equal(
			reservations.filter((reservation) => !reservation.block).length,
			configured.searchCalls,
			`${effort} preflights exactly its search limit`,
		);
		assert.match(reservations.at(-1)?.block ?? "", /no transport was started/);
		for (let index = 0; index < configured.searchCalls; index++)
			ledger.finalize(
				`${effort}-${index}`,
				[{ type: "text", text: "ok" }],
				false,
			);
		const fetchLedger = new ResearchWorkLedger({
			version: 1,
			invocationId: `${effort}-fetches`,
			effort,
			webResearch: "required",
			configured,
			startedAt: "2026-08-13T00:00:00.000Z",
		});
		const fetchReservations = await Promise.all(
			Array.from({ length: configured.fetchCalls + 1 }, (_, index) =>
				Promise.resolve(
					fetchLedger.reserve(`${effort}-fetch-${index}`, "webfetch"),
				),
			),
		);
		assert.equal(
			fetchReservations.filter((reservation) => !reservation.block).length,
			configured.fetchCalls,
			`${effort} preflights exactly its fetch limit`,
		);
		assert.match(
			fetchReservations.at(-1)?.block ?? "",
			/no transport was started/,
		);

		const byteLimit =
			Buffer.byteLength(RESEARCH_BUDGET_TRUNCATION_NOTICE, "utf8") + 7;
		const byteLedger = new ResearchWorkLedger({
			version: 1,
			invocationId: `${effort}-bytes`,
			effort,
			webResearch: "required",
			configured: { ...configured, deliveredBytes: byteLimit },
			startedAt: "2026-08-13T00:00:00.000Z",
		});
		assert.equal(byteLedger.reserve("unicode", "webfetch").block, undefined);
		const original = "a😀漢".repeat(20);
		const content = byteLedger.finalize(
			"unicode",
			[{ type: "text", text: original }],
			false,
		).content!;
		const delivered = content.map((part) => part.text ?? "").join("");
		assert.equal(Buffer.byteLength(delivered, "utf8") <= byteLimit, true);
		assert.equal(
			Buffer.from(content[0].text ?? "", "utf8").toString("utf8"),
			content[0].text,
		);
		assert.equal(
			byteLedger
				.reserve("after-limit", "webfetch")
				.block?.includes("byte budget is exhausted"),
			true,
		);
		assert.equal(byteLedger.telemetry().exhausted.deliveredBytes, true);
		assert.equal(
			byteLedger.telemetry().truncatedBytes,
			Buffer.byteLength(original, "utf8") -
				Buffer.byteLength(content[0].text ?? "", "utf8"),
		);
		for (const [name, size] of [
			["below", configured.deliveredBytes - 1],
			["at", configured.deliveredBytes],
			["above", configured.deliveredBytes + 1],
		] as const) {
			const boundary = new ResearchWorkLedger({
				version: 1,
				invocationId: `${effort}-${name}`,
				effort,
				webResearch: "required",
				configured,
				startedAt: "2026-08-13T00:00:00.000Z",
			});
			assert.equal(boundary.reserve("boundary", "webfetch").block, undefined);
			const result = boundary.finalize(
				"boundary",
				[{ type: "text", text: "x".repeat(size) }],
				false,
			);
			assert.equal(
				Boolean(result.content),
				name === "above",
				`${effort} ${name} byte boundary`,
			);
			assert.equal(
				boundary.telemetry().consumed.deliveredBytes,
				configured.deliveredBytes - (name === "below" ? 1 : 0),
			);
		}

		const cancelled = new ResearchWorkLedger({
			version: 1,
			invocationId: `${effort}-cancel`,
			effort,
			webResearch: "required",
			configured,
			startedAt: "2026-08-13T00:00:00.000Z",
		});
		cancelled.reserve("in-flight", "webfetch");
		cancelled.finalizePending();
		assert.equal(cancelled.telemetry().activeReservations, 0);
		assert.equal(cancelled.telemetry().finalized.fetchCalls, 1);
	}
});

test("Research work-budget audit starts fresh invocations and parent-finalizes stranded reservations", async () => {
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
	const { ResearchSessionStore, RESEARCH_MAPPING_ENTRY } = await import(
		"./research-session.ts"
	);
	const { ResearchWorkLedger } = await import("./research-context.ts");
	const { RESEARCH_WORK_BUDGET_ENTRY } = await import(
		"./research-budget-audit.ts"
	);
	const root = await fs.mkdtemp(path.join(process.cwd(), ".research-budget-"));
	try {
		const parent = SessionManager.create(root, path.join(root, "sessions"));
		const store = new ResearchSessionStore({
			newResearchId: () => "r_11111111-1111-4111-8111-111111111111",
		});
		const target = store.create(parent, root, ["websearch", "webfetch"]);
		parent.appendCustomEntry(RESEARCH_MAPPING_ENTRY, store.mapping(target));
		const input = {
			task: "budget",
			files: [],
			webResearch: "required" as const,
			effort: "standard" as const,
		};
		const first = store.startWorkBudget(target, input)!;
		const firstLedger = new ResearchWorkLedger(first);
		firstLedger.reserve("one", "websearch");
		firstLedger.finalize("one", [{ type: "text", text: "abc" }], false);
		SessionManager.open(target.sessionFile).appendCustomEntry(
			RESEARCH_WORK_BUDGET_ENTRY,
			firstLedger.telemetry(),
		);
		const second = store.startWorkBudget(target, input)!;
		assert.notEqual(second.invocationId, first.invocationId);
		const secondLedger = new ResearchWorkLedger(second);
		assert.equal(secondLedger.reserve("one", "websearch").block, undefined);
		SessionManager.open(target.sessionFile).appendCustomEntry(
			RESEARCH_WORK_BUDGET_ENTRY,
			secondLedger.telemetry(),
		);
		store.finalizeWorkBudget(target, second.invocationId);
		const details = store.workBudgetDetails(target, second.invocationId);
		assert.equal(details.invocation?.invocationId, second.invocationId);
		assert.equal(details.invocation?.activeReservations, 0);
		assert.equal(details.invocation?.finalized.searchCalls, 1);
		assert.equal(details.cumulative.invocations, 2);
		assert.equal(details.cumulative.consumed.searchCalls, 1);
		assert.equal(JSON.stringify(details).includes("budget"), false);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("in-memory Research children activate hooks only with their parent-session marker", async () => {
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
	const { registerResearchContext } = await import("./research-context.ts");
	const {
		RESEARCH_CHILD_ENV,
		RESEARCH_PARENT_ENV,
		ResearchSessionStore,
	} = await import("./research-session.ts");
	const root = await fs.mkdtemp(path.join(process.cwd(), ".research-memory-budget-"));
	try {
		const parent = SessionManager.inMemory(root);
		const store = new ResearchSessionStore({
			newResearchId: () => "r_12121212-1212-4121-8121-121212121212",
		});
		const target = store.create(parent, root, ["websearch", "webfetch"]);
		const configuration = store.startWorkBudget(target, {
			task: "budget",
			files: [],
			webResearch: "required",
			effort: "standard",
		})!;
		const child = SessionManager.open(target.sessionFile);
		const handlers = new Map<string, (event: any, ctx: any) => any>();
		registerResearchContext(
			{
				on(event: string, handler: (event: any, ctx: any) => any) {
					handlers.set(event, handler);
				},
			} as never,
			{
				environment: {
					[RESEARCH_CHILD_ENV]: target.childSessionId,
					[RESEARCH_PARENT_ENV]: parent.getSessionId(),
				},
			},
		);
		for (let index = 0; index < configuration.configured.searchCalls; index++)
			assert.equal(
				handlers.get("tool_call")!(
					{ toolCallId: `memory-${index}`, toolName: "websearch" },
					{ sessionManager: child },
				)?.block,
				undefined,
			);
		assert.match(
			handlers.get("tool_call")!(
				{ toolCallId: "memory-blocked", toolName: "websearch" },
				{ sessionManager: child },
			)?.reason ?? "",
			/no transport was started/,
		);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("trusted child hooks block web transports while direct contexts stay inert", async () => {
	const { SessionManager } = await import("@earendil-works/pi-coding-agent");
	const { registerResearchContext } = await import("./research-context.ts");
	const { RESEARCH_CHILD_ENV, RESEARCH_MAPPING_ENTRY, ResearchSessionStore } =
		await import("./research-session.ts");
	const { RESEARCH_WORK_BUDGET_ENTRY } = await import(
		"./research-budget-audit.ts"
	);
	const root = await fs.mkdtemp(
		path.join(process.cwd(), ".research-budget-hooks-"),
	);
	try {
		const parent = SessionManager.create(root, path.join(root, "sessions"));
		parent.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "parent" }],
			provider: "test",
			model: "test",
			usage: {},
			stopReason: "stop",
			timestamp: Date.now(),
		});
		const store = new ResearchSessionStore({
			newResearchId: () => "r_22222222-2222-4222-8222-222222222222",
		});
		const target = store.create(parent, root, ["websearch", "webfetch"]);
		parent.appendCustomEntry(RESEARCH_MAPPING_ENTRY, store.mapping(target));
		const configuration = store.startWorkBudget(target, {
			task: "budget",
			files: [],
			webResearch: "required",
			effort: "standard",
		})!;
		const child = SessionManager.open(target.sessionFile);
		const handlers = new Map<string, (event: any, ctx: any) => any>();
		const audit: unknown[] = [];
		registerResearchContext(
			{
				on(event: string, handler: (event: any, ctx: any) => any) {
					handlers.set(event, handler);
				},
				appendEntry(customType: string, data: unknown) {
					if (customType === RESEARCH_WORK_BUDGET_ENTRY) audit.push(data);
				},
			} as never,
			{ environment: { [RESEARCH_CHILD_ENV]: target.childSessionId } },
		);
		let transports = 0;
		await Promise.all(
			Array.from(
				{ length: configuration.configured.searchCalls + 1 },
				(_, index) =>
					Promise.resolve().then(() => {
						const result = handlers.get("tool_call")!(
							{
								toolCallId: `search-${index}`,
								toolName: "websearch",
								input: { query: "q" },
							},
							{ sessionManager: child },
						);
						if (!result?.block) transports++;
						return result;
					}),
			),
		);
		assert.equal(transports, configuration.configured.searchCalls);
		assert.ok(
			audit.length > 0,
			"each reservation is persisted outside child model context",
		);
		const direct = handlers.get("tool_call")!(
			{
				toolCallId: "direct",
				toolName: "webfetch",
				input: { url: "https://example.com" },
			},
			{ sessionManager: parent },
		);
		assert.equal(
			direct,
			undefined,
			"direct parent web tools have no Research budget policy",
		);
		assert.equal(
			store.startWorkBudget(target, {
				task: "no web",
				files: [],
				webResearch: "disabled",
				effort: "standard",
			}),
			undefined,
		);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("normal Pi compaction resumes a trusted Research child without masking its transcript", async () => {
	const {
		createAgentSession,
		DefaultResourceLoader,
		SessionManager,
		SettingsManager,
	} = await import("@earendil-works/pi-coding-agent");
	const { registerSubagentExtension } = await import("./index.ts");
	const { RESEARCH_CHILD_ENV, ResearchSessionStore } = await import(
		"./research-session.ts"
	);
	const root = await fs.mkdtemp(
		path.join(process.cwd(), ".research-compaction-"),
	);
	const sessionDir = path.join(root, "sessions");
	const payloads: unknown[] = [];
	const originalFetch = globalThis.fetch;
	let request = 0;
	(globalThis as { fetch: typeof fetch }).fetch = async (_input, init) => {
		payloads.push(JSON.parse(String(init?.body)));
		const text =
			request++ === 1
				? "## Goal\nNormal Pi compaction summary"
				: request === 1
					? "first child response"
					: "continued after compaction";
		const chunk = {
			id: `compaction-${request}`,
			object: "chat.completion.chunk",
			choices: [
				{
					index: 0,
					delta: { role: "assistant", content: text },
					finish_reason: "stop",
				},
			],
			usage: { prompt_tokens: 10_000, completion_tokens: 1 },
		};
		return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	};
	try {
		const parent = SessionManager.create(root, sessionDir);
		parent.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "parent stays isolated" }],
			provider: "test",
			model: "fake",
			usage: {},
			stopReason: "stop",
			timestamp: Date.now(),
		});
		const store = new ResearchSessionStore({
			newResearchId: () => "r_88888888-8888-4888-8888-888888888888",
		});
		const target = store.create(parent, root, ["websearch"]);
		parent.appendCustomEntry("research-session", store.mapping(target));
		const child = SessionManager.open(target.sessionFile, sessionDir);
		child.appendMessage({
			role: "user",
			content: [{ type: "text", text: "old child task" }],
			timestamp: Date.now(),
		});
		for (const index of [0, 1, 2, 3]) {
			child.appendMessage({
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: `stale-${index}`,
						name: "websearch",
						arguments: { query: `old query ${index}` },
					},
				],
				provider: "test",
				model: "fake",
				usage: {},
				stopReason: "toolUse",
				timestamp: Date.now(),
			});
			child.appendMessage({
				role: "toolResult",
				toolCallId: `stale-${index}`,
				toolName: "websearch",
				content: [
					{
						type: "text",
						text:
							index === 0
								? `COMPACTION-STALE-${"x".repeat(20_000)}`
								: `recent result ${index}-${"x".repeat(20_000)}`,
					},
				],
				details: { query: `old query ${index}` },
				isError: false,
				timestamp: Date.now(),
			});
		}
		child.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "old child complete" }],
			provider: "test",
			model: "fake",
			usage: {},
			stopReason: "stop",
			timestamp: Date.now(),
		});
		child.appendMessage({
			role: "user",
			content: [{ type: "text", text: "newer completed task" }],
			timestamp: Date.now(),
		});
		child.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "newer child complete" }],
			provider: "test",
			model: "fake",
			usage: {},
			stopReason: "stop",
			timestamp: Date.now(),
		});
		const before = await fs.readFile(target.sessionFile, "utf8");
		const beforeHash = createHash("sha256").update(before).digest("hex");
		const loader = new DefaultResourceLoader({
			cwd: root,
			agentDir: root,
			extensionFactories: [
				(pi) => {
					pi.registerProvider("research-compaction-fake", {
						baseUrl: "http://research-compaction.invalid/v1",
						apiKey: "test",
						api: "openai-completions",
						models: [
							{
								id: "fake",
								name: "Fake",
								reasoning: false,
								input: ["text"],
								cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
								contextWindow: 100,
								maxTokens: 50,
							},
						],
					});
					registerSubagentExtension(pi, {
						researchContext: {
							environment: { [RESEARCH_CHILD_ENV]: target.childSessionId },
						},
					});
				},
			],
		});
		await loader.reload();
		const { session } = await createAgentSession({
			cwd: root,
			resourceLoader: loader,
			sessionManager: child,
			settingsManager: SettingsManager.inMemory({
				compaction: { enabled: true, reserveTokens: 20, keepRecentTokens: 20 },
			}),
			tools: [],
			thinkingLevel: "off",
			model: {
				id: "fake",
				name: "Fake",
				api: "openai-completions",
				provider: "research-compaction-fake",
				baseUrl: "http://research-compaction.invalid/v1",
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 100,
				maxTokens: 50,
			},
		});
		try {
			await session.prompt("trigger normal compaction");
			await session.prompt("continue after normal compaction");
		} finally {
			session.dispose();
		}
		assert.ok(
			child.getEntries().some((entry) => entry.type === "compaction"),
			"Pi must append its normal compaction entry",
		);
		assert.ok(
			payloads.length >= 3,
			"first turn, normal compaction, and resumed turn must all call the provider",
		);
		assert.equal(
			JSON.stringify(payloads[0]).includes("COMPACTION-STALE-"),
			false,
			"the captured child provider payload must receive the deterministic mask, not stale evidence",
		);
		assert.match(
			JSON.stringify(payloads.at(-1)),
			/Normal Pi compaction summary/,
		);
		const after = await fs.readFile(target.sessionFile, "utf8");
		assert.equal(
			createHash("sha256").update(after).digest("hex") === beforeHash,
			false,
			"normal Pi compaction must append its result",
		);
		assert.equal(
			after.startsWith(before),
			true,
			"normal Pi compaction must append without rewriting prior child entries",
		);
		assert.equal(
			after.includes("COMPACTION-STALE-"),
			true,
			"compaction and masking must preserve original stored evidence",
		);
		assert.equal(before.includes("COMPACTION-STALE-"), true);
		const maskingEntries = child
			.getEntries()
			.filter(
				(entry) =>
					entry.type === "custom" && entry.customType === "research-context",
			);
		assert.ok(
			maskingEntries.length > 0,
			"each trusted child context preparation must persist evidence-free telemetry",
		);
		assert.equal(
			JSON.stringify(maskingEntries).includes("COMPACTION-STALE-"),
			false,
		);
	} finally {
		(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
		await fs.rm(root, { recursive: true, force: true });
	}
});
