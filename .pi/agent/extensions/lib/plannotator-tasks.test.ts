import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import plannotatorPlanPath from "../plannotator-plan-path.ts";
import { buildTasksSkillMessage, TASKS_SKILL_COMMAND } from "./plannotator-tasks.ts";

test("uses the renamed tasks command", () => {
	assert.equal(TASKS_SKILL_COMMAND, "skill:tasks");
});

test("expands the tasks skill and approved plan into one user message", () => {
	const skillDirectory = mkdtempSync(join(tmpdir(), "plannotator-tasks-"));
	const skillPath = join(skillDirectory, "SKILL.md");
	writeFileSync(
		skillPath,
		"---\nname: tasks\ndescription: test\n---\n\n# Tasks\n\nCreate TASKS.md.\n",
	);

	const message = buildTasksSkillMessage(skillPath, {
		cwd: "/repo",
		planFilePath: ".agents/2026-08-12-example/PLAN.md",
		feedback: "Keep the migration reversible.",
	});

	assert.match(message, /^<skill name="tasks" location=/);
	assert.match(message, /References are relative to .*plannotator-tasks-/);
	assert.doesNotMatch(message, /description: test/);
	assert.match(message, /# Tasks\n\nCreate TASKS\.md\./);
	assert.match(message, /Do not implement the plan\./);
	assert.match(message, /Plan: \.agents\/2026-08-12-example\/PLAN\.md/);
	assert.match(message, /Working directory: \/repo/);
	assert.match(message, /Approval notes to incorporate:\nKeep the migration reversible\./);
});

test("omits the approval-notes section when feedback is blank", () => {
	const skillDirectory = mkdtempSync(join(tmpdir(), "plannotator-tasks-"));
	const skillPath = join(skillDirectory, "SKILL.md");
	writeFileSync(skillPath, "# Tasks\n");

	const message = buildTasksSkillMessage(skillPath, {
		cwd: "/repo",
		planFilePath: ".agents/example/PLAN.md",
		feedback: "  ",
	});

	assert.doesNotMatch(message, /Approval notes/);
});

test("approved plans steer the expanded tasks skill into the active session", () => {
	const skillDirectory = mkdtempSync(join(tmpdir(), "plannotator-tasks-"));
	const skillPath = join(skillDirectory, "SKILL.md");
	writeFileSync(skillPath, "---\nname: tasks\ndescription: test\n---\n# Tasks\n");

	let approvalHandler: ((data: unknown) => void) | undefined;
	let sent: { content: string; options: unknown } | undefined;
	const pi = {
		events: {
			on(channel: string, handler: (data: unknown) => void) {
				assert.equal(channel, "plannotator:plan-approved");
				approvalHandler = handler;
			},
		},
		registerCommand() {},
		on() {},
		getCommands() {
			return [
				{
					name: "skill:tasks",
					source: "skill",
					sourceInfo: { path: skillPath },
				},
			];
		},
		sendUserMessage(content: string, options: unknown) {
			sent = { content, options };
		},
	};

	plannotatorPlanPath(pi as never);
	assert.ok(approvalHandler);
	approvalHandler({
		cwd: "/repo",
		planFilePath: ".agents/example/PLAN.md",
		feedback: "Preserve compatibility.",
	});

	assert.deepEqual(sent?.options, { deliverAs: "steer" });
	assert.match(sent?.content ?? "", /^<skill name="tasks"/);
	assert.match(sent?.content ?? "", /Plan: \.agents\/example\/PLAN\.md/);
	assert.match(sent?.content ?? "", /Preserve compatibility\./);
});

test("automatic approval overrides are stopped before tasks are queued", async () => {
	const skillDirectory = mkdtempSync(join(tmpdir(), "plannotator-tasks-"));
	const skillPath = join(skillDirectory, "SKILL.md");
	writeFileSync(skillPath, "---\nname: tasks\ndescription: test\n---\n# Tasks\n");

	let toolResultHandler: ((event: any, ctx: any) => Promise<any>) | undefined;
	let sent: { content: string; options: unknown } | undefined;
	const pi = {
		events: {
			on() {},
			emit(channel: string, request: any) {
				assert.equal(channel, "plannotator:request");
				assert.deepEqual(request.payload, { mode: "exit" });
				request.respond({ status: "handled", result: { phase: "idle" } });
			},
		},
		registerCommand() {},
		on(name: string, handler: (event: any, ctx: any) => Promise<any>) {
			if (name === "tool_result") toolResultHandler = handler;
		},
		getCommands() {
			return [
				{
					name: "skill:tasks",
					source: "skill",
					sourceInfo: { path: skillPath },
				},
			];
		},
		sendUserMessage(content: string, options: unknown) {
			sent = { content, options };
		},
	};

	plannotatorPlanPath(pi as never);
	assert.ok(toolResultHandler);
	const patch = await toolResultHandler(
		{
			toolName: "plannotator_submit_plan",
			input: { filePath: ".agents/override/PLAN.md" },
			details: { approved: true, feedback: "One task only." },
		},
		{ cwd: "/repo" },
	);

	assert.equal(patch.isError, undefined);
	assert.equal(patch.details.tasksQueued, true);
	assert.match(patch.content[0].text, /implementation was stopped/);
	assert.deepEqual(sent?.options, { deliverAs: "steer" });
	assert.match(sent?.content ?? "", /Plan: \.agents\/override\/PLAN\.md/);
	assert.match(sent?.content ?? "", /One task only\./);
});

test("plan command selects Astra, enters Plannotator, and starts the grill skill", async () => {
	const astra = { provider: "openai-codex", id: "gpt-6-astra" };
	const sol = { provider: "openai-codex", id: "gpt-5.6-sol" };
	let planHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
	let sent: { content: string; options: unknown } | undefined;
	const selectedModels: string[] = [];

	const pi = {
		events: {
			on() {},
			emit(channel: string, request: any) {
				assert.equal(channel, "plannotator:request");
				const mode = request.payload.mode;
				assert.ok(mode === "status" || mode === "enter");
				request.respond({
					status: "handled",
					result: { phase: mode === "status" ? "idle" : "planning" },
				});
			},
		},
		registerCommand(name: string, options: any) {
			if (name === "plan") planHandler = options.handler;
		},
		on() {},
		getCommands() {
			return [{ name: "skill:grill", source: "skill", sourceInfo: { path: "/skills/grill/SKILL.md" } }];
		},
		async setModel(model: { id: string }) {
			selectedModels.push(model.id);
			return true;
		},
		sendUserMessage(content: string, options: unknown) {
			sent = { content, options };
		},
		getActiveTools() {
			return [];
		},
	};

	plannotatorPlanPath(pi as never);
	assert.ok(planHandler);
	await planHandler("replace the auth flow", {
		mode: "tui",
		isIdle: () => true,
		model: sol,
		modelRegistry: {
			find(provider: string, id: string) {
				return provider === astra.provider && id === astra.id ? astra : undefined;
			},
		},
		ui: { notify() {} },
	});

	assert.deepEqual(selectedModels, ["gpt-6-astra"]);
	assert.deepEqual(sent, {
		content: "/skill:grill replace the auth flow",
		options: { expandPromptTemplates: true },
	});
});

test("switches to Sol after approved-plan task creation settles", async () => {
	const skillDirectory = mkdtempSync(join(tmpdir(), "plannotator-tasks-"));
	const skillPath = join(skillDirectory, "SKILL.md");
	writeFileSync(skillPath, "---\nname: tasks\ndescription: test\n---\n# Tasks\n");

	let approvalHandler: ((data: unknown) => void) | undefined;
	let settledHandler: ((event: unknown, ctx: any) => Promise<void>) | undefined;
	const selectedModels: string[] = [];
	const pi = {
		events: {
			on(_channel: string, handler: (data: unknown) => void) {
				approvalHandler = handler;
			},
		},
		registerCommand() {},
		on(name: string, handler: any) {
			if (name === "agent_settled") settledHandler = handler;
		},
		getCommands() {
			return [{ name: "skill:tasks", source: "skill", sourceInfo: { path: skillPath } }];
		},
		sendUserMessage() {},
		async setModel(model: { id: string }) {
			selectedModels.push(model.id);
			return true;
		},
		getActiveTools() {
			return [];
		},
	};

	plannotatorPlanPath(pi as never);
	assert.ok(approvalHandler);
	assert.ok(settledHandler);
	approvalHandler({ cwd: "/repo", planFilePath: ".agents/example/PLAN.md" });
	await settledHandler({}, {
		modelRegistry: {
			find(provider: string, id: string) {
				return provider === "openai-codex" && id === "gpt-5.6-sol" ? { provider, id } : undefined;
			},
		},
		ui: { notify() {} },
	});

	assert.deepEqual(selectedModels, ["gpt-5.6-sol"]);
});
