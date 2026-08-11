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
	boundParallelOutput,
	boundTailOutput,
	type ChildRunResult,
	cloneProgressResults,
	mapWithConcurrencyLimit,
	MAX_PARALLEL_CONCURRENCY,
	MAX_PARALLEL_TASKS,
	resolveWorkingDirectory,
	runChild,
	selectChildTools,
	type UsageStats,
	validateDispatchMode,
} from "./runner.ts";

const COLLAPSED_ITEM_COUNT = 10;

type TaskStatus = "queued" | "running" | "completed" | "failed";

interface SingleResult extends Omit<ChildRunResult, "messages"> {
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	messages: Message[];
	status: TaskStatus;
}

interface SubagentDetails {
	mode: "single" | "parallel";
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
		status: "failed",
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
		result.status === "failed" ||
		(result.status !== "queued" &&
			result.status !== "running" &&
			(Boolean(result.failureMessage) ||
				result.exitCode !== 0 ||
				result.stopReason === "error" ||
				result.stopReason === "aborted" ||
				result.stopReason === "length"))
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

function combineResult(
	base: Pick<SingleResult, "agent" | "agentSource" | "task">,
	child: ChildRunResult,
	status: "running" | "completed" | "failed",
): SingleResult {
	return { ...base, ...child, messages: child.messages as unknown as Message[], status };
}

function makePendingResult(agent: AgentConfig | undefined, agentName: string, task: string, status: "queued" | "running"): SingleResult {
	return {
		agent: agentName,
		agentSource: agent?.source ?? "unknown",
		task,
		exitCode: 0,
		messages: [],
		stderr: "",
		malformedStdout: "",
		usage: emptyUsage(),
		model: agent?.model,
		status,
	};
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
						const result = combineResult(base, snapshot, "running");
						onUpdate({
							content: [{ type: "text", text: boundModelOutput(getFinalOutput(result.messages) || "(running...)") }],
							details: makeDetails([result]),
						});
					}
				: undefined,
		});
		const completed = combineResult(base, child, "completed");
		if (!completed.model) completed.model = model;
		if (isFailedResult(completed)) completed.status = "failed";
		return completed;
	} catch (error) {
		return makeFailure(agentName, task, error instanceof Error ? error.message : String(error));
	} finally {
		if (temporaryDir) await fs.promises.rm(temporaryDir, { recursive: true, force: true });
	}
}

function aggregateUsage(results: readonly SingleResult[]): UsageStats {
	return results.reduce(
		(total, result) => ({
			input: total.input + result.usage.input,
			output: total.output + result.usage.output,
			cacheRead: total.cacheRead + result.usage.cacheRead,
			cacheWrite: total.cacheWrite + result.usage.cacheWrite,
			cost: total.cost + result.usage.cost,
			contextTokens: total.contextTokens + result.usage.contextTokens,
			turns: total.turns + result.usage.turns,
		}),
		emptyUsage(),
	);
}

function parallelProgress(results: readonly SingleResult[]): string {
	const completed = results.filter((result) => result.status === "completed").length;
	const failed = results.filter((result) => result.status === "failed").length;
	const running = results.filter((result) => result.status === "running").length;
	const queued = results.filter((result) => result.status === "queued").length;
	return `Parallel: ${completed + failed}/${results.length} done, ${running} running, ${queued} queued, ${failed} failed`;
}

function parallelSectionHeader(result: SingleResult, index: number): string {
	const label = result.agent.replace(/\s+/g, " ").trim().slice(0, 160) || "unknown";
	const status = isFailedResult(result)
		? `failed${result.stopReason && result.stopReason !== "end" ? ` (${result.stopReason})` : ""}`
		: "completed";
	return `### Task ${index + 1}: [${label}] ${status}`;
}

function formatParallelModelOutput(results: readonly SingleResult[]): string {
	const successCount = results.filter((result) => !isFailedResult(result)).length;
	return boundParallelOutput(
		`Parallel: ${successCount}/${results.length} succeeded`,
		results.map((result, index) => ({
			header: parallelSectionHeader(result, index),
			output: getResultOutput(result),
		})),
		{ maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES },
		truncateTail,
		formatSize,
	);
}

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Agent discovery scope. Default: "user". Project agents require explicit "project" or "both".',
	default: "user",
});

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke", minLength: 1 }),
	task: Type.String({ description: "Task to delegate", minLength: 1 }),
	cwd: Type.Optional(Type.String({ description: "Working directory, resolved from the parent cwd" })),
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (single mode)", minLength: 1 })),
	task: Type.Optional(Type.String({ description: "Task to delegate (single mode)", minLength: 1 })),
	cwd: Type.Optional(Type.String({ description: "Working directory, resolved from the parent cwd (single mode)" })),
	tasks: Type.Optional(
		Type.Array(TaskItem, {
			description: "Tasks to execute in parallel, with at most four children running concurrently",
			minItems: 1,
			maxItems: MAX_PARALLEL_TASKS,
		}),
	),
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
			"Delegate one task, or 1 through 8 parallel tasks, to specialized agents in isolated contexts.",
			"Provide exactly one mode: agent + task, or tasks.",
			`User agents come from ${path.join(getAgentDir(), "agents")}.`,
			`Set agentScope to "project" or "both" to include ${CONFIG_DIR_NAME}/agents.`,
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const selectedMode = validateDispatchMode(params);
			const emptyDetails = (mode: "single" | "parallel"): SubagentDetails => ({
				mode,
				agentScope,
				projectAgentsDir: null,
				results: [],
			});
			if ("error" in selectedMode) {
				return {
					content: [{ type: "text", text: selectedMode.error }],
					details: emptyDetails(selectedMode.mode),
					isError: true,
				};
			}
			try {
				assertCanDelegate();
			} catch (error) {
				return {
					content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
					details: emptyDetails(selectedMode.mode),
					isError: true,
				};
			}

			const discovery = discoverAgents(ctx.cwd, agentScope);
			const makeDetails =
				(mode: "single" | "parallel") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});
			const requestedNames = new Set(
				selectedMode.mode === "parallel" ? params.tasks!.map((task) => task.agent) : [params.agent!],
			);
			const projectAgents = [...requestedNames]
				.map((name) => discovery.agents.find((candidate) => candidate.name === name))
				.filter((agent): agent is AgentConfig => agent?.source === "project");
			if (projectAgents.length > 0 && (params.confirmProjectAgents ?? true)) {
				if (!ctx.hasUI) {
					return {
						content: [{ type: "text", text: "Denied: project-local agents require confirmation, but no UI is available." }],
						details: makeDetails(selectedMode.mode)([]),
						isError: true,
					};
				}
				const approved = await ctx.ui.confirm(
					projectAgents.length === 1 ? "Run project-local agent?" : "Run project-local agents?",
					`Agents: ${projectAgents.map((agent) => agent.name).join(", ")}\nSource: ${discovery.projectAgentsDir ?? "(unknown)"}\n\nOnly continue for a trusted repository.`,
				);
				if (!approved) {
					return {
						content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
						details: makeDetails(selectedMode.mode)([]),
						isError: true,
					};
				}
			}

			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
			};
			const parentActiveTools = pi.getActiveTools();

			if (selectedMode.mode === "parallel") {
				const tasks = params.tasks!;
				const allResults = tasks.map((task) =>
					makePendingResult(
						discovery.agents.find((agent) => agent.name === task.agent),
						task.agent,
						task.task,
						"queued",
					),
				);
				const emitParallelUpdate = () => {
					if (!onUpdate) return;
					const snapshot = cloneProgressResults(allResults);
					onUpdate({
						content: [{ type: "text", text: boundModelOutput(parallelProgress(snapshot)) }],
						details: makeDetails("parallel")(snapshot),
					});
				};
				emitParallelUpdate();

				const results = await mapWithConcurrencyLimit(tasks, MAX_PARALLEL_CONCURRENCY, async (task, index) => {
					allResults[index] = { ...allResults[index], status: "running" };
					emitParallelUpdate();
					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						parentActiveTools,
						discovery.agents,
						task.agent,
						task.task,
						task.cwd,
						signal,
						(partial) => {
							const current = partial.details?.results[0];
							if (!current) return;
							allResults[index] = current;
							emitParallelUpdate();
						},
						makeDetails("parallel"),
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});
				return {
					content: [{ type: "text", text: formatParallelModelOutput(results) }],
					details: makeDetails("parallel")(results),
				};
			}

			const result = await runSingleAgent(
				ctx.cwd,
				dispatchDefaults,
				parentActiveTools,
				discovery.agents,
				params.agent!,
				params.task!,
				params.cwd,
				signal,
				onUpdate,
				makeDetails("single"),
			);
			const failed = isFailedResult(result);
			return {
				content: [{ type: "text", text: boundModelOutput(getResultOutput(result)) }],
				details: makeDetails("single")([result]),
				isError: failed,
			};
		},

		renderCall(args, theme) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.tasks) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const task of args.tasks.slice(0, 3)) {
					const preview = task.task.length > 40 ? `${task.task.slice(0, 40)}...` : task.task;
					text += `\n  ${theme.fg("accent", task.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agent = args.agent ?? "...";
			const rawTask = args.task ?? "...";
			const task = rawTask.length > 60 ? `${rawTask.slice(0, 60)}...` : rawTask;
			return new Text(
				`${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", agent)}${theme.fg("muted", ` [${scope}]`)}\n  ${theme.fg("dim", task)}`,
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
			if (details.mode === "parallel") {
				const running = details.results.filter((item) => item.status === "running").length;
				const queued = details.results.filter((item) => item.status === "queued").length;
				const completed = details.results.filter((item) => item.status === "completed").length;
				const failed = details.results.filter((item) => item.status === "failed").length;
				const inProgress = running + queued > 0;
				const icon = inProgress ? theme.fg("warning", "...") : failed ? theme.fg("warning", "!") : theme.fg("success", "ok");
				const summary = inProgress
					? `${completed + failed}/${details.results.length} done, ${running} running, ${queued} queued`
					: `${completed}/${details.results.length} succeeded`;

				if (expanded && !inProgress) {
					const container = new Container();
					container.addChild(
						new Text(`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", summary)}`, 0, 0),
					);
					for (const item of details.results) {
						const itemIcon = isFailedResult(item) ? theme.fg("error", "x") : theme.fg("success", "ok");
						const displayItems = getDisplayItems(item.messages);
						const finalOutput = getFinalOutput(item.messages);
						const diagnostic = getFailureDiagnostic(item);
						container.addChild(new Spacer(1));
						container.addChild(
							new Text(`${theme.fg("muted", "--- ")}${theme.fg("accent", item.agent)} ${itemIcon}`, 0, 0),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", item.task), 0, 0));
						for (const displayItem of displayItems) {
							if (displayItem.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "-> ") + formatToolCall(displayItem.name, displayItem.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, getMarkdownTheme()));
						} else if (!diagnostic) container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
						if (diagnostic) container.addChild(new Text(theme.fg("error", diagnostic), 0, 0));
						const taskUsage = formatUsageStats(item.usage, item.model);
						if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
					}
					const totalUsage = formatUsageStats(aggregateUsage(details.results));
					if (totalUsage) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${totalUsage}`), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", summary)}`;
				for (const item of details.results) {
					const itemIcon =
						item.status === "queued"
							? theme.fg("muted", "queued")
							: item.status === "running"
								? theme.fg("warning", "...")
								: isFailedResult(item)
									? theme.fg("error", "x")
									: theme.fg("success", "ok");
					const displayItems = getDisplayItems(item.messages);
					const visibleItems = displayItems.slice(-5);
					const diagnostic = getFailureDiagnostic(item);
					text += `\n\n${theme.fg("muted", "--- ")}${theme.fg("accent", item.agent)} ${itemIcon}`;
					if (displayItems.length > visibleItems.length) {
						text += `\n${theme.fg("muted", `... ${displayItems.length - visibleItems.length} earlier items`)}`;
					}
					for (const displayItem of visibleItems) {
						if (displayItem.type === "text") {
							text += `\n${theme.fg("toolOutput", displayItem.text.split("\n").slice(0, 3).join("\n"))}`;
						} else {
							text += `\n${theme.fg("muted", "-> ")}${formatToolCall(displayItem.name, displayItem.args, theme.fg.bind(theme))}`;
						}
					}
					if (diagnostic) text += `\n${theme.fg("error", diagnostic)}`;
					else if (!visibleItems.length) {
						const empty = item.status === "queued" ? "(queued)" : item.status === "running" ? "(running...)" : "(no output)";
						text += `\n${theme.fg("muted", empty)}`;
					}
					const taskUsage = formatUsageStats(item.usage, item.model);
					if (taskUsage) text += `\n${theme.fg("dim", taskUsage)}`;
				}
				if (!inProgress) {
					const totalUsage = formatUsageStats(aggregateUsage(details.results));
					if (totalUsage) text += `\n\n${theme.fg("dim", `Total: ${totalUsage}`)}`;
				}
				if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}
			const agent = details.results[0];
			const failed = isFailedResult(agent);
			const inProgress = agent.status === "queued" || agent.status === "running";
			const status = isPartial || inProgress ? theme.fg("warning", "...") : failed ? theme.fg("error", "x") : theme.fg("success", "ok");
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
				} else if (!diagnostic) container.addChild(new Text(theme.fg("muted", inProgress ? "(running...)" : "(no output)"), 0, 0));
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
			else if (!visibleItems.length) text += `\n${theme.fg("muted", inProgress ? "(running...)" : "(no output)")}`;
			if (usage) text += `\n${theme.fg("dim", usage)}`;
			if (!inProgress) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
			return new Text(text, 0, 0);
		},
	});
}
