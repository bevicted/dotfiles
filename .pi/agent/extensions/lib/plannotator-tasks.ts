import { readFileSync } from "node:fs";
import { dirname } from "node:path";

export const TASKS_SKILL_COMMAND = "skill:tasks";

export interface ApprovedPlan {
	cwd: string;
	planFilePath: string;
	feedback?: string;
}

function stripFrontmatter(content: string): string {
	const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (!normalized.startsWith("---")) return normalized;

	const endIndex = normalized.indexOf("\n---", 3);
	if (endIndex === -1) return normalized;
	return normalized.slice(endIndex + 4).trim();
}

export function buildTasksSkillMessage(skillFilePath: string, event: ApprovedPlan): string {
	const body = stripFrontmatter(readFileSync(skillFilePath, "utf8")).trim();
	if (!body) throw new Error(`Tasks skill is empty: ${skillFilePath}`);

	const skillBlock = `<skill name="tasks" location="${skillFilePath}">\nReferences are relative to ${dirname(skillFilePath)}.\n\n${body}\n</skill>`;
	const feedback = event.feedback?.trim();
	const taskSelector = [
		"Create implementation tasks for the approved Plannotator plan. Do not implement the plan.",
		`Plan: ${event.planFilePath}`,
		`Working directory: ${event.cwd}`,
	];
	if (feedback) {
		taskSelector.push("", "Approval notes to incorporate:", feedback);
	}

	return `${skillBlock}\n\n${taskSelector.join("\n")}`;
}
