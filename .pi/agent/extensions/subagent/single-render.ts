import * as os from "node:os";
import { getFinalAssistantText, type UsageStats } from "./runner.ts";

const COLLAPSED_ITEM_COUNT = 10;

export type SingleRenderState = "running" | "failed" | "completed";
export type SingleRenderStatus = "queued" | "running" | "completed" | "failed";

export interface SingleRenderPresentation {
	label: string;
	source?: string;
	state: SingleRenderState;
}

export interface SingleRenderPresentationInput {
	agent: string;
	agentSource: string;
	status: SingleRenderStatus;
	isPartial: boolean;
	failed: boolean;
	oracle?: boolean;
}

export interface RenderableSingleResult {
	agent: string;
	agentSource: string;
	task: string;
	messages: unknown[];
	status: SingleRenderStatus;
	exitCode: number;
	stderr: string;
	malformedStdout: string;
	usage: UsageStats;
	failureMessage?: string;
	errorMessage?: string;
	stopReason?: string;
	model?: string;
}

export type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

export interface SingleRenderTheme {
	fg(color: any, text: string): string;
	bold(text: string): string;
}

export interface SingleRenderAdapter<Node> {
	text(text: string): Node;
	spacer(): Node;
	markdown(text: string): Node;
	container(children: Node[]): Node;
}

export function formatTaskPreview(task: string, maximumLength = 60): string {
	return task.length > maximumLength ? `${task.slice(0, maximumLength)}...` : task;
}

export function describeSingleResult(input: SingleRenderPresentationInput): SingleRenderPresentation {
	return {
		label: input.oracle ? "oracle" : input.agent,
		source: input.oracle ? undefined : input.agentSource,
		state:
			input.isPartial || input.status === "queued" || input.status === "running"
				? "running"
				: input.failed
					? "failed"
					: "completed",
	};
}

export function getDisplayItems(messages: unknown[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const message of messages as any[]) {
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (part.type === "text") items.push({ type: "text", text: part.text });
			else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
		}
	}
	return items;
}

export function getFinalOutput(messages: unknown[]): string {
	return getFinalAssistantText(messages as any);
}

export function getFailureDiagnostic(result: RenderableSingleResult): string {
	const parts = [result.failureMessage, result.errorMessage, result.stderr.trim() || undefined];
	if (result.malformedStdout.trim()) parts.push(`Non-JSON stdout:\n${result.malformedStdout.trim()}`);
	return parts.filter((part): part is string => Boolean(part)).join("\n");
}

function formatTokens(count: number): string {
	if (count < 1_000) return count.toString();
	if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
	return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatUsageStats(usage: UsageStats, model?: string): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`);
	if (usage.input) parts.push(`in:${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`out:${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`cache-read:${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`cache-write:${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens) parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	if (model) parts.push(model);
	return parts.join(" ");
}

export function formatToolCall(
	toolName: string,
	args: Record<string, unknown>,
	themeFg: (color: any, text: string) => string,
): string {
	const shortenPath = (value: string) => {
		const home = os.homedir();
		return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
	};
	if (toolName === "read") {
		const file = shortenPath(String(args.file_path ?? args.path ?? "..."));
		return themeFg("muted", "read ") + themeFg("accent", file);
	}
	if (toolName === "grep") {
		return (
			themeFg("muted", "grep ") +
			themeFg("accent", `/${String(args.pattern ?? "")}/`) +
			themeFg("dim", ` in ${shortenPath(String(args.path ?? "."))}`)
		);
	}
	if (toolName === "find") {
		return (
			themeFg("muted", "find ") +
			themeFg("accent", String(args.pattern ?? "*")) +
			themeFg("dim", ` in ${shortenPath(String(args.path ?? "."))}`)
		);
	}
	if (toolName === "ls") return themeFg("muted", "ls ") + themeFg("accent", shortenPath(String(args.path ?? ".")));
	if (toolName === "bash") {
		const command = String(args.command ?? "...");
		return themeFg("muted", "$ ") + themeFg("toolOutput", command.length > 60 ? `${command.slice(0, 60)}...` : command);
	}
	const serialized = JSON.stringify(args);
	return themeFg("accent", toolName) + themeFg("dim", ` ${serialized.length > 50 ? `${serialized.slice(0, 50)}...` : serialized}`);
}

export function renderSingleResult<Node>(
	agent: RenderableSingleResult,
	options: { expanded: boolean; isPartial: boolean; failed: boolean; oracle?: boolean },
	theme: SingleRenderTheme,
	adapter: SingleRenderAdapter<Node>,
): Node {
	const presentation = describeSingleResult({
		agent: agent.agent,
		agentSource: agent.agentSource,
		status: agent.status,
		isPartial: options.isPartial,
		failed: options.failed,
		oracle: options.oracle,
	});
	const status =
		presentation.state === "running"
			? theme.fg("warning", "...")
			: presentation.state === "failed"
				? theme.fg("error", "x")
				: theme.fg("success", "ok");
	const header = `${status} ${theme.fg("toolTitle", theme.bold(presentation.label))}${presentation.source ? theme.fg("muted", ` (${presentation.source})`) : ""}`;
	const displayItems = getDisplayItems(agent.messages);
	const finalOutput = getFinalOutput(agent.messages);
	const diagnostic = getFailureDiagnostic(agent);
	const usage = formatUsageStats(agent.usage, agent.model);

	if (options.expanded) {
		const children = [adapter.text(header), adapter.spacer(), adapter.text(theme.fg("muted", "--- Task ---")), adapter.text(theme.fg("dim", agent.task)), adapter.spacer(), adapter.text(theme.fg("muted", "--- Output ---"))];
		for (const item of displayItems) {
			if (item.type === "toolCall") children.push(adapter.text(theme.fg("muted", "-> ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))));
		}
		if (finalOutput) {
			children.push(adapter.spacer(), adapter.markdown(finalOutput.trim()));
		} else if (!diagnostic) {
			children.push(adapter.text(theme.fg("muted", presentation.state === "running" ? "(running...)" : "(no output)")));
		}
		if (diagnostic) children.push(adapter.spacer(), adapter.text(theme.fg("error", diagnostic)));
		if (usage) children.push(adapter.spacer(), adapter.text(theme.fg("dim", usage)));
		return adapter.container(children);
	}

	let text = header;
	const visibleItems = displayItems.slice(-COLLAPSED_ITEM_COUNT);
	if (displayItems.length > visibleItems.length) text += `\n${theme.fg("muted", `... ${displayItems.length - visibleItems.length} earlier items`)}`;
	for (const item of visibleItems) {
		if (item.type === "text") text += `\n${theme.fg("toolOutput", item.text.split("\n").slice(0, 3).join("\n"))}`;
		else text += `\n${theme.fg("muted", "-> ")}${formatToolCall(item.name, item.args, theme.fg.bind(theme))}`;
	}
	if (diagnostic) text += `\n${theme.fg("error", diagnostic)}`;
	else if (!visibleItems.length) text += `\n${theme.fg("muted", presentation.state === "running" ? "(running...)" : "(no output)")}`;
	if (usage) text += `\n${theme.fg("dim", usage)}`;
	if (presentation.state !== "running") text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
	return adapter.text(text);
}

export function renderOracleCall<Node>(task: string, theme: SingleRenderTheme, adapter: SingleRenderAdapter<Node>): Node {
	return adapter.text(`${theme.fg("toolTitle", theme.bold("oracle"))}\n  ${theme.fg("dim", formatTaskPreview(task))}`);
}

export function renderGenericSingleCall<Node>(
	agent: string,
	scope: string,
	task: string,
	theme: SingleRenderTheme,
	adapter: SingleRenderAdapter<Node>,
): Node {
	return adapter.text(
		`${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", agent)}${theme.fg("muted", ` [${scope}]`)}\n  ${theme.fg("dim", formatTaskPreview(task))}`,
	);
}
