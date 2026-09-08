import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildTasksSkillMessage, TASKS_SKILL_COMMAND, type ApprovedPlan } from "./lib/plannotator-tasks.ts";

const PLAN_SUBMIT_TOOL = "plannotator_submit_plan";
const PLAN_APPROVED_CHANNEL = "plannotator:plan-approved";
const PLANNOTATOR_REQUEST_CHANNEL = "plannotator:request";
const GUIDANCE_TYPE = "plannotator-plan-path-guidance";
const GRILL_SKILL_COMMAND = "skill:grill";
const PLAN_MODEL = { provider: "openai-codex", id: "gpt-6-astra" } as const;
const POST_TASKS_MODEL = { provider: "openai-codex", id: "gpt-5.6-sol" } as const;
const PLAN_MODE_TIMEOUT_MS = 5_000;
const GUIDANCE = `[PLANNOTATOR - PLAN PATH GUIDANCE]
Create this task's plan at \`.agents/<YYYY-MM-DD>-<short-kebab-slug>/PLAN.md\`. Choose a stable, task-specific ID for the first draft. Reuse that exact path for every revision of the same plan and when resubmitting it with plannotator_submit_plan. Approval hands the plan to the tasks skill; do not implement it in this session.`;

function isGuidanceMessage(message: AgentMessage): boolean {
	return "customType" in message && message.customType === GUIDANCE_TYPE;
}

export default function plannotatorPlanPath(pi: ExtensionAPI): void {
	let guidanceInjected = false;
	let switchModelAfterTasks = false;

	function requestPlanMode(mode: "enter" | "exit" | "status"): Promise<"idle" | "planning" | "executing"> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error(`Timed out while asking Plannotator to ${mode} plan mode.`)),
				PLAN_MODE_TIMEOUT_MS,
			);
			pi.events.emit(PLANNOTATOR_REQUEST_CHANNEL, {
				requestId: `plan-workflow-${mode}-${Date.now()}`,
				action: "plan-mode",
				payload: { mode },
				respond(response: { status: string; result?: { phase?: unknown }; error?: string }): void {
					clearTimeout(timeout);
					const phase = response.result?.phase;
					if (
						response.status === "handled" &&
						(phase === "idle" || phase === "planning" || phase === "executing")
					) {
						resolve(phase);
						return;
					}
					reject(new Error(response.error ?? "Plannotator plan-mode control is unavailable."));
				},
			});
		});
	}

	async function selectModel(
		ref: { provider: string; id: string },
		ctx: ExtensionContext,
	): Promise<boolean> {
		const model = ctx.modelRegistry.find(ref.provider, ref.id);
		if (!model) {
			ctx.ui.notify(`Model ${ref.provider}/${ref.id} was not found.`, "error");
			return false;
		}
		if (!(await pi.setModel(model))) {
			ctx.ui.notify(`No API key is available for ${ref.provider}/${ref.id}.`, "error");
			return false;
		}
		return true;
	}

	function dispatchTasks(event: ApprovedPlan): void {
		const tasksSkill = pi
			.getCommands()
			.find((command) => command.source === "skill" && command.name === TASKS_SKILL_COMMAND);
		if (!tasksSkill) throw new Error("Could not find the /skill:tasks skill.");

		const message = buildTasksSkillMessage(tasksSkill.sourceInfo.path, event);
		switchModelAfterTasks = true;
		try {
			pi.sendUserMessage(message, { deliverAs: "steer" });
		} catch (error) {
			switchModelAfterTasks = false;
			throw error;
		}
	}

	async function stopAutomaticExecution(): Promise<void> {
		await requestPlanMode("exit");
	}

	async function isPlannotatorIdle(ctx: ExtensionContext): Promise<boolean> {
		try {
			const currentPhase = await requestPlanMode("status");
			if (currentPhase === "idle") return true;
			ctx.ui.notify(`Plannotator is already in ${currentPhase} mode.`, "warning");
		} catch (error) {
			ctx.ui.notify(
				`Could not start the planning workflow: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
		return false;
	}

	async function startPlanning(args: string, ctx: ExtensionContext): Promise<void> {
		const previousModel = ctx.model;
		if (!(await selectModel(PLAN_MODEL, ctx))) return;

		let planningEntered = false;
		try {
			const phase = await requestPlanMode("enter");
			if (phase !== "planning") {
				throw new Error(`Plannotator is in ${phase} mode instead of planning mode.`);
			}
			planningEntered = true;
			const topic = args.trim();
			pi.sendUserMessage(`/${GRILL_SKILL_COMMAND}${topic ? ` ${topic}` : ""}`, {
				expandPromptTemplates: true,
			});
		} catch (error) {
			if (planningEntered) {
				try {
					await requestPlanMode("exit");
				} catch {
					ctx.ui.notify("Could not roll back Plannotator plan mode.", "warning");
				}
			}
			if (previousModel) await pi.setModel(previousModel);
			ctx.ui.notify(
				`Could not start the planning workflow: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
	}

	pi.registerCommand("plan", {
		description: "Plan with GPT-6 Astra, Plannotator, and the grill interview",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/plan requires interactive mode.", "error");
				return;
			}
			if (!ctx.isIdle()) {
				ctx.ui.notify("Wait for the current agent run before starting /plan.", "warning");
				return;
			}

			const grillSkill = pi
				.getCommands()
				.find((command) => command.source === "skill" && command.name === GRILL_SKILL_COMMAND);
			if (!grillSkill) {
				ctx.ui.notify("Could not find the /skill:grill skill.", "error");
				return;
			}
			if (!(await isPlannotatorIdle(ctx))) return;
			await startPlanning(args, ctx);
		},
	});

	pi.events.on(PLAN_APPROVED_CHANNEL, (data) => {
		const event = data as Partial<ApprovedPlan> | null;
		if (!event || typeof event.cwd !== "string" || typeof event.planFilePath !== "string") {
			console.error("Plannotator tasks handoff received an invalid approved-plan event.");
			return;
		}

		try {
			dispatchTasks({
				cwd: event.cwd,
				planFilePath: event.planFilePath,
				...(typeof event.feedback === "string" ? { feedback: event.feedback } : {}),
			});
		} catch (error) {
			console.error(
				`Plannotator tasks handoff failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	});

	// A project-local Plannotator config can override the global external mode.
	// Catch that automatic approval path, return Plannotator to idle, and replace
	// its execution instruction before the agent can continue.
	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== PLAN_SUBMIT_TOOL) return;
		const details = event.details as { approved?: boolean; handedOff?: boolean; feedback?: unknown } | undefined;
		if (details?.approved !== true || details.handedOff === true) return;

		const filePath = (event.input as { filePath?: unknown }).filePath;
		if (typeof filePath !== "string" || !filePath.trim()) return;

		try {
			await stopAutomaticExecution();
			dispatchTasks({
				cwd: ctx.cwd,
				planFilePath: filePath,
				...(typeof details.feedback === "string" ? { feedback: details.feedback } : {}),
			});
			return {
				content: [
					{
						type: "text" as const,
						text: "Plan approved. Current-session implementation was stopped and implementation task creation was queued.",
					},
				],
				details: { ...details, tasksQueued: true },
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text" as const, text: `Plan approved, but the tasks handoff failed: ${message}` }],
				isError: true,
			};
		}
	});

	pi.on("agent_settled", async (_event, ctx) => {
		if (!switchModelAfterTasks) return;
		switchModelAfterTasks = false;
		if (await selectModel(POST_TASKS_MODEL, ctx)) {
			ctx.ui.notify("Implementation tasks created. Switched to GPT-5.6 Sol.", "info");
		}
	});

	pi.on("before_agent_start", () => {
		if (!pi.getActiveTools().includes(PLAN_SUBMIT_TOOL)) {
			guidanceInjected = false;
			return;
		}
		if (guidanceInjected) return;

		guidanceInjected = true;
		return {
			message: {
				customType: GUIDANCE_TYPE,
				content: GUIDANCE,
				display: false,
			},
		};
	});

	pi.on("context", (event) => {
		const planning = pi.getActiveTools().includes(PLAN_SUBMIT_TOOL);
		let latestGuidance = -1;
		if (planning) {
			for (let index = event.messages.length - 1; index >= 0; index -= 1) {
				if (isGuidanceMessage(event.messages[index])) {
					latestGuidance = index;
					break;
				}
			}
		}

		const messages = event.messages.filter(
			(message, index) => !isGuidanceMessage(message) || index === latestGuidance,
		);
		if (messages.length !== event.messages.length) return { messages };
	});
}
