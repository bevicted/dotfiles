import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PLAN_SUBMIT_TOOL = "plannotator_submit_plan";
const GUIDANCE_TYPE = "plannotator-plan-path-guidance";
const GUIDANCE = `[PLANNOTATOR - PLAN PATH GUIDANCE]
Create this task's plan at \`.agents/<YYYY-MM-DD>-<short-kebab-slug>/PLAN.md\`. Choose a stable, task-specific ID for the first draft. Reuse that exact path for every revision of the same plan and when resubmitting it with plannotator_submit_plan.`;

function isGuidanceMessage(message: AgentMessage): boolean {
	return "customType" in message && message.customType === GUIDANCE_TYPE;
}

export default function plannotatorPlanPath(pi: ExtensionAPI): void {
	let guidanceInjected = false;

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
