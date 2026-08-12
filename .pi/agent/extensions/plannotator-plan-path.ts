import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildTasksSkillMessage, TASKS_SKILL_COMMAND, type ApprovedPlan } from "./lib/plannotator-tasks.ts";

const PLAN_SUBMIT_TOOL = "plannotator_submit_plan";
const PLAN_APPROVED_CHANNEL = "plannotator:plan-approved";
const PLANNOTATOR_REQUEST_CHANNEL = "plannotator:request";
const GUIDANCE_TYPE = "plannotator-plan-path-guidance";
const GUIDANCE = `[PLANNOTATOR - PLAN PATH GUIDANCE]
Create this task's plan at \`.agents/<YYYY-MM-DD>-<short-kebab-slug>/PLAN.md\`. Choose a stable, task-specific ID for the first draft. Reuse that exact path for every revision of the same plan and when resubmitting it with plannotator_submit_plan. Approval hands the plan to the tasks skill; do not implement it in this session.`;

function isGuidanceMessage(message: AgentMessage): boolean {
	return "customType" in message && message.customType === GUIDANCE_TYPE;
}

export default function plannotatorPlanPath(pi: ExtensionAPI): void {
	let guidanceInjected = false;

	function dispatchTasks(event: ApprovedPlan): void {
		const tasksSkill = pi
			.getCommands()
			.find((command) => command.source === "skill" && command.name === TASKS_SKILL_COMMAND);
		if (!tasksSkill) throw new Error("Could not find the /skill:tasks skill.");

		const message = buildTasksSkillMessage(tasksSkill.sourceInfo.path, event);
		pi.sendUserMessage(message, { deliverAs: "steer" });
	}

	function stopAutomaticExecution(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("Timed out while leaving Plannotator execution mode.")), 5_000);
			pi.events.emit(PLANNOTATOR_REQUEST_CHANNEL, {
				requestId: `tasks-handoff-${Date.now()}`,
				action: "plan-mode",
				payload: { mode: "exit" },
				respond(response: { status: string; error?: string }): void {
					clearTimeout(timeout);
					if (response.status === "handled") {
						resolve();
						return;
					}
					reject(new Error(response.error ?? "Plannotator plan-mode control is unavailable."));
				},
			});
		});
	}

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
