import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	CONFIG_DIR_NAME,
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type ExtensionAPI,
	formatSize,
	getAgentDir,
	getMarkdownTheme,
	truncateTail,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts";
import {
	assertCanDelegate,
	boundTailOutput,
	type ChildRunResult,
	resolveWorkingDirectory,
	runChild,
	selectChildTools,
	type UsageStats,
} from "./runner.ts";

const COLLAPSED_ITEM_COUNT = 10;

interface SingleResult extends Omit<ChildRunResult, "messages"> {
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	messages: Message[];
	running: boolean;
}

interface SubagentDetails {
	mode: "single";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

interface DispatchDefaults {
	model?: string;
	thinkingLevel?: ThinkingLevel;
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;
type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

function makeFailure(agent: string, task: string, failureMessage: string): SingleResult {
	return {
		agent,
		agentSource: "unknown",
		task,
		exitCode: 1,
		messages: [],
		stderr: "",
		malformedStdout: "",
		usage: emptyUsage(),
		failureMessage,
		running: false,
	};
}

function getFinalOutput(messages: Message[]): string {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (part.type === "text") return part.text;
		}
	}
	return "";
}

function isFailedResult(result: SingleResult): boolean {
	return (
		!result.running &&
		(Boolean(result.failureMessage) ||
			result.exitCode !== 0 ||
			result.stopReason === "error" ||
			result.stopReason === "aborted" ||
			result.stopReason === "length")
	);
}

function getFailureDiagnostic(result: SingleResult): string {
	const parts = [result.failureMessage, result.errorMessage, result.stderr.trim() || undefined];
	if (result.malformedStdout.trim()) parts.push(`Non-JSON stdout:\n${result.malformedStdout.trim()}`);
	return parts.filter((part): part is string => Boolean(part)).join("\n");
}

function getResultOutput(result: SingleResult): string {
	if (isFailedResult(result)) return getFailureDiagnostic(result) || getFinalOutput(result.messages) || "(no output)";
	return getFinalOutput(result.messages) || "(no output)";
}

function boundModelOutput(output: string): string {
	return boundTailOutput(
		output,
		{ maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES },
		truncateTail,
		formatSize,
	);
}

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (part.type === "text") items.push({ type: "text", text: part.text });
			else if (part.type === "toolCall") {
				items.push({ type: "toolCall", name: part.name, args: part.arguments });
			}
		}
	}
	return items;
}

function formatTokens(count: number): string {
	if (count < 1_000) return count.toString();
	if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
	return `${(count / 1_000_000).toFixed(1)}M`;
}

function formatUsageStats(usage: UsageStats, model?: string): string {
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

function formatToolCall(
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
	if (toolName === "ls") {
		return themeFg("muted", "ls ") + themeFg("accent", shortenPath(String(args.path ?? ".")));
	}
	if (toolName === "bash") {
		const command = String(args.command ?? "...");
		return themeFg("muted", "$ ") + themeFg("toolOutput", command.length > 60 ? `${command.slice(0, 60)}...` : command);
	}
	const serialized = JSON.stringify(args);
	return themeFg("accent", toolName) + themeFg("dim", ` ${serialized.length > 50 ? `${serialized.slice(0, 50)}...` : serialized}`);
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const filePath = path.join(dir, `prompt-${agentName.replace(/[^\w.-]+/g, "_")}.md`);
	try {
		await withFileMutationQueue(filePath, () =>
			fs.promises.writeFile(filePath, prompt, { encoding: "utf8", mode: 0o600 }),
		);
		return { dir, filePath };
	} catch (error) {
		await fs.promises.rm(dir, { recursive: true, force: true });
		throw error;
	}
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const executable = path.basename(process.execPath).toLowerCase();
	if (!/^(node|bun)(\.exe)?$/.test(executable)) return { command: process.execPath, args };
	return { command: "pi", args };
}

function combineResult(base: Pick<SingleResult, "agent" | "agentSource" | "task">, child: ChildRunResult, running: boolean): SingleResult {
	return { ...base, ...child, messages: child.messages as unknown as Message[], running };
}

async function runSingleAgent(
	defaultCwd: string,
	dispatchDefaults: DispatchDefaults,
	parentActiveTools: readonly string[],
	agents: AgentConfig[],
	agentName: string,
	task: string,
	cwd: string | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> {
	const agent = agents.find((candidate) => candidate.name === agentName);
	if (!agent) {
		const available = agents.map((candidate) => `"${candidate.name}"`).join(", ") || "none";
		return makeFailure(agentName, task, `Unknown agent: "${agentName}". Available agents: ${available}.`);
	}

	let resolvedCwd: string;
	try {
		resolvedCwd = resolveWorkingDirectory(defaultCwd, cwd);
	} catch (error) {
		return makeFailure(agentName, task, error instanceof Error ? error.message : String(error));
	}

	const model = agent.model ?? dispatchDefaults.model;
	const args = ["--mode", "json", "-p", "--no-session"];
	if (model) args.push("--model", model);
	if (!agent.model && dispatchDefaults.thinkingLevel) args.push("--thinking", dispatchDefaults.thinkingLevel);
	const tools = selectChildTools(agent.tools, parentActiveTools);
	if (tools.length > 0) args.push("--tools", tools.join(","));
	else args.push("--no-tools");

	let temporaryDir: string | undefined;
	try {
		if (agent.systemPrompt.trim()) {
			const temporary = await writePromptToTempFile(agent.name, agent.systemPrompt);
			temporaryDir = temporary.dir;
			args.push("--append-system-prompt", temporary.filePath);
		}
		const invocation = getPiInvocation(args);
		const base = { agent: agent.name, agentSource: agent.source, task } as const;
		const child = await runChild({
			...invocation,
			task,
			cwd: resolvedCwd,
			signal,
			onUpdate: onUpdate
				? (snapshot) => {
						const result = combineResult(base, snapshot, true);
						onUpdate({
							content: [{ type: "text", text: boundModelOutput(getFinalOutput(result.messages) || "(running...)") }],
							details: makeDetails([result]),
						});
					}
				: undefined,
		});
		const result = combineResult(base, child, false);
		if (!result.model) result.model = model;
		return result;
	} catch (error) {
		return makeFailure(agentName, task, error instanceof Error ? error.message : String(error));
	} finally {
		if (temporaryDir) await fs.promises.rm(temporaryDir, { recursive: true, force: true });
	}
}

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Agent discovery scope. Default: "user". Project agents require explicit "project" or "both".',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate" }),
	cwd: Type.Optional(Type.String({ description: "Working directory, resolved from the parent cwd" })),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate one task to a specialized agent in an isolated context.",
			`User agents come from ${path.join(getAgentDir(), "agents")}.`,
			`Set agentScope to "project" or "both" to include ${CONFIG_DIR_NAME}/agents.`,
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const emptyDetails = (): SubagentDetails => ({
				mode: "single",
				agentScope,
				projectAgentsDir: null,
				results: [],
			});
			try {
				assertCanDelegate();
			} catch (error) {
				return {
					content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
					details: emptyDetails(),
					isError: true,
				};
			}

			const discovery = discoverAgents(ctx.cwd, agentScope);
			const makeDetails = (results: SingleResult[]): SubagentDetails => ({
				mode: "single",
				agentScope,
				projectAgentsDir: discovery.projectAgentsDir,
				results,
			});
			const agent = discovery.agents.find((candidate) => candidate.name === params.agent);
			if (agent?.source === "project" && (params.confirmProjectAgents ?? true)) {
				if (!ctx.hasUI) {
					return {
						content: [{ type: "text", text: "Denied: project-local agents require confirmation, but no UI is available." }],
						details: makeDetails([]),
						isError: true,
					};
				}
				const approved = await ctx.ui.confirm(
					"Run project-local agent?",
					`Agent: ${agent.name}\nSource: ${discovery.projectAgentsDir ?? "(unknown)"}\n\nOnly continue for a trusted repository.`,
				);
				if (!approved) {
					return {
						content: [{ type: "text", text: "Canceled: project-local agent not approved." }],
						details: makeDetails([]),
						isError: true,
					};
				}
			}

			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
			};
			const result = await runSingleAgent(
				ctx.cwd,
				dispatchDefaults,
				pi.getActiveTools(),
				discovery.agents,
				params.agent,
				params.task,
				params.cwd,
				signal,
				onUpdate,
				makeDetails,
			);
			const failed = isFailedResult(result);
			return {
				content: [{ type: "text", text: boundModelOutput(getResultOutput(result)) }],
				details: makeDetails([result]),
				isError: failed,
			};
		},

		renderCall(args, theme) {
			const scope: AgentScope = args.agentScope ?? "user";
			const task = args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task;
			return new Text(
				`${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", args.agent)}${theme.fg("muted", ` [${scope}]`)}\n  ${theme.fg("dim", task)}`,
				0,
				0,
			);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as SubagentDetails | undefined;
			if (!details?.results.length) {
				const content = result.content[0];
				return new Text(content?.type === "text" ? content.text : "(no output)", 0, 0);
			}
			const agent = details.results[0];
			const failed = isFailedResult(agent);
			const status = isPartial || agent.running ? theme.fg("warning", "...") : failed ? theme.fg("error", "x") : theme.fg("success", "ok");
			const header = `${status} ${theme.fg("toolTitle", theme.bold(agent.agent))}${theme.fg("muted", ` (${agent.agentSource})`)}`;
			const displayItems = getDisplayItems(agent.messages);
			const finalOutput = getFinalOutput(agent.messages);
			const diagnostic = getFailureDiagnostic(agent);
			const usage = formatUsageStats(agent.usage, agent.model);

			if (expanded) {
				const container = new Container();
				container.addChild(new Text(header, 0, 0));
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "--- Task ---"), 0, 0));
				container.addChild(new Text(theme.fg("dim", agent.task), 0, 0));
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "--- Output ---"), 0, 0));
				for (const item of displayItems) {
					if (item.type === "toolCall") {
						container.addChild(new Text(theme.fg("muted", "-> ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0));
					}
				}
				if (finalOutput) {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(finalOutput.trim(), 0, 0, getMarkdownTheme()));
				} else if (!diagnostic) container.addChild(new Text(theme.fg("muted", agent.running ? "(running...)" : "(no output)"), 0, 0));
				if (diagnostic) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("error", diagnostic), 0, 0));
				}
				if (usage) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("dim", usage), 0, 0));
				}
				return container;
			}

			let text = header;
			const visibleItems = displayItems.slice(-COLLAPSED_ITEM_COUNT);
			if (displayItems.length > visibleItems.length) text += `\n${theme.fg("muted", `... ${displayItems.length - visibleItems.length} earlier items`)}`;
			for (const item of visibleItems) {
				if (item.type === "text") text += `\n${theme.fg("toolOutput", item.text.split("\n").slice(0, 3).join("\n"))}`;
				else text += `\n${theme.fg("muted", "-> ")}${formatToolCall(item.name, item.args, theme.fg.bind(theme))}`;
			}
			if (diagnostic) text += `\n${theme.fg("error", diagnostic)}`;
			else if (!visibleItems.length) text += `\n${theme.fg("muted", agent.running ? "(running...)" : "(no output)")}`;
			if (usage) text += `\n${theme.fg("dim", usage)}`;
			if (!agent.running) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
			return new Text(text, 0, 0);
		},
	});
}
