import { spawn as nodeSpawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export const CHILD_DEPTH_ENV = "PI_SUBAGENT_DEPTH";
export const ABORT_GRACE_MS = 5_000;
export const MAX_PARALLEL_TASKS = 8;
export const MAX_PARALLEL_CONCURRENCY = 4;
export const MAX_CHAIN_STEPS = 8;

export interface NormalizedAgentMetadata {
	name: string;
	description: string;
	tools?: string[];
	model?: string;
}

export interface ChildMessage {
	role: string;
	content: Array<Record<string, unknown>>;
	usage?: {
		input?: number;
		output?: number;
		cacheRead?: number;
		cacheWrite?: number;
		cost?: { total?: number };
		totalTokens?: number;
	};
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	[key: string]: unknown;
}

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export interface ChildRunResult {
	exitCode: number;
	signal?: string;
	messages: ChildMessage[];
	stderr: string;
	malformedStdout: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	failureMessage?: string;
}

interface EventSource {
	on(event: string, listener: (...args: any[]) => void): this;
}

interface ChildInput extends EventSource {
	end(data?: string): void;
}

interface SpawnedChild extends EventSource {
	stdin: ChildInput;
	stdout: EventSource;
	stderr: EventSource;
	kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnChild = (
	command: string,
	args: readonly string[],
	options: {
		cwd: string;
		env: NodeJS.ProcessEnv;
		shell: false;
		stdio: ["pipe", "pipe", "pipe"];
	},
) => SpawnedChild;

export interface RunChildOptions {
	command: string;
	args: string[];
	task: string;
	cwd: string;
	signal?: AbortSignal;
	onUpdate?: (snapshot: ChildRunResult) => void;
	spawn?: SpawnChild;
	setTimeout?: typeof setTimeout;
	clearTimeout?: typeof clearTimeout;
}

interface TailTruncation {
	content: string;
	truncated: boolean;
	totalLines: number;
	totalBytes: number;
}

export interface ParallelOutputSection {
	header: string;
	output: string;
}

export type DispatchMode = "single" | "parallel" | "chain";

export function validateDispatchMode(params: {
	agent?: unknown;
	task?: unknown;
	cwd?: unknown;
	tasks?: unknown;
	chain?: unknown;
}): { mode: DispatchMode } | { error: string; mode: DispatchMode } {
	const hasSingleFields = params.agent !== undefined || params.task !== undefined || params.cwd !== undefined;
	const hasParallelFields = params.tasks !== undefined;
	const hasChainFields = params.chain !== undefined;
	const fallbackMode: DispatchMode = hasChainFields ? "chain" : hasParallelFields ? "parallel" : "single";
	if (Number(hasSingleFields) + Number(hasParallelFields) + Number(hasChainFields) !== 1) {
		return {
			error: "Invalid parameters. Provide exactly one mode: agent + task, tasks, or chain.",
			mode: fallbackMode,
		};
	}
	if (hasParallelFields) {
		if (!Array.isArray(params.tasks) || params.tasks.length === 0) {
			return { error: "Parallel mode requires 1 through 8 tasks.", mode: "parallel" };
		}
		if (params.tasks.length > MAX_PARALLEL_TASKS) {
			return {
				error: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
				mode: "parallel",
			};
		}
		return { mode: "parallel" };
	}
	if (hasChainFields) {
		if (!Array.isArray(params.chain) || params.chain.length === 0) {
			return { error: "Chain mode requires 1 through 8 steps.", mode: "chain" };
		}
		if (params.chain.length > MAX_CHAIN_STEPS) {
			return {
				error: `Too many chain steps (${params.chain.length}). Max is ${MAX_CHAIN_STEPS}.`,
				mode: "chain",
			};
		}
		return { mode: "chain" };
	}
	if (typeof params.agent !== "string" || !params.agent.trim() || typeof params.task !== "string" || !params.task.trim()) {
		return { error: "Single mode requires non-empty agent and task strings.", mode: "single" };
	}
	return { mode: "single" };
}

export interface SequentialChainResult<TResult> {
	results: TResult[];
	failedIndex?: number;
}

export function getFinalAssistantText(messages: readonly unknown[]): string {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message || typeof message !== "object" || Array.isArray(message)) continue;
		const record = message as Record<string, unknown>;
		if (record.role !== "assistant" || !Array.isArray(record.content)) continue;
		return record.content
			.filter(
				(part): part is Record<string, unknown> =>
					Boolean(part) && typeof part === "object" && !Array.isArray(part) && part.type === "text",
			)
			.map((part) => (typeof part.text === "string" ? part.text : ""))
			.join("");
	}
	return "";
}

export function replacePreviousOutput(task: string, previousOutput: string): string {
	return task.replaceAll("{previous}", previousOutput);
}

export async function runSequentialChain<TStep extends { task: string }, TResult>(
	steps: readonly TStep[],
	execute: (step: TStep, resolvedTask: string, index: number, completedResults: readonly TResult[]) => Promise<TResult>,
	isFailure: (result: TResult) => boolean,
	getFinalOutput: (result: TResult) => string,
): Promise<SequentialChainResult<TResult>> {
	const results: TResult[] = [];
	let previousOutput = "";
	for (let index = 0; index < steps.length; index++) {
		const step = steps[index];
		const result = await execute(step, replacePreviousOutput(step.task, previousOutput), index, results);
		results.push(result);
		if (isFailure(result)) return { results, failedIndex: index };
		previousOutput = getFinalOutput(result);
	}
	return { results };
}

export async function mapWithConcurrencyLimit<TInput, TOutput>(
	items: readonly TInput[],
	concurrency: number,
	fn: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results = new Array<TOutput>(items.length);
	let nextIndex = 0;
	const workers = Array.from({ length: limit }, async () => {
		while (true) {
			const index = nextIndex++;
			if (index >= items.length) return;
			results[index] = await fn(items[index], index);
		}
	});
	await Promise.all(workers);
	return results;
}

export function cloneProgressResults<T>(results: readonly T[]): T[] {
	return structuredClone(results);
}

function countNewlines(value: string): number {
	let count = 0;
	for (const character of value) if (character === "\n") count++;
	return count;
}

export function boundParallelOutput(
	aggregateHeader: string,
	sections: readonly ParallelOutputSection[],
	limits: { maxLines: number; maxBytes: number },
	truncate: (value: string, limits: { maxLines: number; maxBytes: number }) => TailTruncation,
	formatBytes: (bytes: number) => string,
): string {
	if (sections.length === 0) return boundTailOutput(aggregateHeader, limits, truncate, formatBytes);
	const separator = "\n\n---\n\n";
	const prefixes = sections.map((section) => `${section.header}\n\n`);
	const fixed = `${aggregateHeader}\n\n${prefixes.join(separator)}`;
	const fixedBytes = Buffer.byteLength(fixed, "utf8");
	const fixedLines = countNewlines(fixed) + 1 - sections.length;
	let sectionLines = Math.max(1, Math.floor((limits.maxLines - fixedLines) / sections.length));
	let sectionBytes = Math.max(1, Math.floor((limits.maxBytes - fixedBytes) / sections.length));

	const build = () => {
		const bounded = sections.map((section) =>
			`${section.header}\n\n${boundTailOutput(
				section.output,
				{ maxLines: sectionLines, maxBytes: sectionBytes },
				truncate,
				formatBytes,
			)}`,
		);
		return `${aggregateHeader}\n\n${bounded.join(separator)}`;
	};

	let output = build();
	let guard = truncate(output, limits);
	while (guard.truncated && (sectionLines > 1 || sectionBytes > 1)) {
		sectionLines = Math.max(1, Math.floor(sectionLines / 2));
		sectionBytes = Math.max(1, Math.floor(sectionBytes / 2));
		output = build();
		guard = truncate(output, limits);
	}
	if (!guard.truncated) return output;

	const fallback = `${aggregateHeader}\n\n${sections
		.map((section) => `${section.header}\n\n(output omitted by aggregate guard; full messages remain in tool details.)`)
		.join(separator)}`;
	const fallbackGuard = truncate(fallback, limits);
	return fallbackGuard.truncated ? fallbackGuard.content : fallback;
}

export function boundTailOutput(
	output: string,
	limits: { maxLines: number; maxBytes: number },
	truncate: (value: string, limits: { maxLines: number; maxBytes: number }) => TailTruncation,
	formatBytes: (bytes: number) => string,
): string {
	const initial = truncate(output, limits);
	if (!initial.truncated) return output;
	const notice = `[Subagent output truncated: retained the tail of ${initial.totalLines} lines / ${formatBytes(initial.totalBytes)}. Full messages remain in tool details.]`;
	const body = truncate(output, {
		maxLines: Math.max(1, limits.maxLines - 2),
		maxBytes: Math.max(1, limits.maxBytes - Buffer.byteLength(notice, "utf8") - 2),
	});
	return `${body.content}\n\n${notice}`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

export function normalizeAgentMetadata(value: unknown): NormalizedAgentMetadata | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const metadata = value as Record<string, unknown>;
	if (!isNonEmptyString(metadata.name) || !isNonEmptyString(metadata.description)) return null;
	if (metadata.model !== undefined && !isNonEmptyString(metadata.model)) return null;
	if (metadata.tools !== undefined && typeof metadata.tools !== "string") return null;

	const tools = metadata.tools
		?.split(",")
		.map((tool) => tool.trim())
		.filter(Boolean);

	return {
		name: metadata.name,
		description: metadata.description,
		tools: tools && tools.length > 0 ? tools : undefined,
		model: metadata.model,
	};
}

export function findNearestAgentsDirectory(cwd: string, configDirectoryName: string): string | null {
	let current = path.resolve(cwd);
	while (true) {
		const candidate = path.join(current, configDirectoryName, "agents");
		try {
			if (fs.statSync(candidate).isDirectory()) return candidate;
		} catch {
			// Continue toward the filesystem root.
		}
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

export function resolveWorkingDirectory(parentCwd: string, requestedCwd?: string): string {
	const resolved = path.resolve(parentCwd, requestedCwd ?? ".");
	let stats: fs.Stats;
	try {
		stats = fs.statSync(resolved);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`Subagent cwd does not exist or cannot be read: ${resolved} (${reason})`);
	}
	if (!stats.isDirectory()) throw new Error(`Subagent cwd is not a directory: ${resolved}`);
	return resolved;
}

export function selectChildTools(requestedTools: string[] | undefined, parentActiveTools: readonly string[]): string[] {
	const isDelegationTool = (tool: string) => tool === "subagent" || tool === "oracle";
	const parentTools = new Set(parentActiveTools.filter((tool) => !isDelegationTool(tool)));
	const candidates = requestedTools ?? parentActiveTools;
	return [...new Set(candidates.filter((tool) => !isDelegationTool(tool) && parentTools.has(tool)))];
}

export function assertCanDelegate(environment: NodeJS.ProcessEnv = process.env): void {
	if (environment[CHILD_DEPTH_ENV]) {
		throw new Error("Nested subagent delegation is disabled.");
	}
}

function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

function finiteNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isChildMessage(value: unknown): value is ChildMessage {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const message = value as Record<string, unknown>;
	return typeof message.role === "string" && Array.isArray(message.content);
}

function cloneResult(result: ChildRunResult): ChildRunResult {
	return structuredClone(result);
}

function modelFailure(stopReason: string | undefined): boolean {
	return stopReason === "error" || stopReason === "aborted" || stopReason === "length";
}

export async function runChild(options: RunChildOptions): Promise<ChildRunResult> {
	assertCanDelegate();
	const result: ChildRunResult = {
		exitCode: 0,
		messages: [],
		stderr: "",
		malformedStdout: "",
		usage: emptyUsage(),
	};
	if (options.signal?.aborted) {
		return { ...result, exitCode: 1, failureMessage: "Subagent was aborted before spawn." };
	}
	const spawn = options.spawn ?? (nodeSpawn as unknown as SpawnChild);
	const schedule = options.setTimeout ?? setTimeout;
	const cancelTimer = options.clearTimeout ?? clearTimeout;
	let child: SpawnedChild;
	try {
		child = spawn(options.command, options.args, {
			cwd: options.cwd,
			env: { ...process.env, [CHILD_DEPTH_ENV]: "1" },
			shell: false,
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ...result, exitCode: 1, failureMessage: `Failed to spawn subagent: ${message}` };
	}

	let stdoutBuffer = "";
	let sawJson = false;
	let spawnError: string | undefined;
	let aborted = false;
	let closed = false;
	let killTimer: ReturnType<typeof setTimeout> | undefined;

	const emitUpdate = () => options.onUpdate?.(cloneResult(result));
	const processLine = (line: string) => {
		if (!line.trim()) return;
		let event: unknown;
		try {
			event = JSON.parse(line);
			sawJson = true;
		} catch {
			result.malformedStdout += `${line}\n`;
			return;
		}
		if (!event || typeof event !== "object" || Array.isArray(event)) return;
		const record = event as Record<string, unknown>;
		if ((record.type !== "message_end" && record.type !== "tool_result_end") || !isChildMessage(record.message)) {
			return;
		}

		const message = record.message;
		result.messages.push(message);
		if (message.role === "assistant") {
			result.usage.turns++;
			if (message.usage && typeof message.usage === "object") {
				result.usage.input += finiteNumber(message.usage.input);
				result.usage.output += finiteNumber(message.usage.output);
				result.usage.cacheRead += finiteNumber(message.usage.cacheRead);
				result.usage.cacheWrite += finiteNumber(message.usage.cacheWrite);
				result.usage.cost += finiteNumber(message.usage.cost?.total);
				result.usage.contextTokens = finiteNumber(message.usage.totalTokens);
			}
			if (!result.model && typeof message.model === "string") result.model = message.model;
			if (typeof message.stopReason === "string") result.stopReason = message.stopReason;
			if (typeof message.errorMessage === "string") result.errorMessage = message.errorMessage;
		}
		emitUpdate();
	};

	child.stdout.on("data", (data: Buffer | string) => {
		stdoutBuffer += data.toString();
		const lines = stdoutBuffer.split(/\r?\n/);
		stdoutBuffer = lines.pop() ?? "";
		for (const line of lines) processLine(line);
	});
	child.stderr.on("data", (data: Buffer | string) => {
		result.stderr += data.toString();
	});
	child.stdin.on("error", (error: Error) => {
		if (!spawnError) spawnError = `Failed to send task to subagent stdin: ${error.message}`;
	});

	const close = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
		child.on("error", (error: Error) => {
			spawnError = error.message;
		});
		child.on("close", (code: number | null, signal: NodeJS.Signals | null) => resolve({ code, signal }));
	});
	const abortChild = () => {
		if (closed || aborted) return;
		aborted = true;
		child.kill("SIGTERM");
		killTimer = schedule(() => {
			if (!closed) child.kill("SIGKILL");
		}, ABORT_GRACE_MS);
	};
	if (options.signal?.aborted) abortChild();
	else options.signal?.addEventListener("abort", abortChild, { once: true });

	try {
		child.stdin.end(`Task: ${options.task}`);
	} catch (error) {
		spawnError = `Failed to send task to subagent stdin: ${error instanceof Error ? error.message : String(error)}`;
		child.kill("SIGTERM");
	}
	const closedWith = await close;
	closed = true;
	if (killTimer !== undefined) cancelTimer(killTimer);
	options.signal?.removeEventListener("abort", abortChild);
	if (stdoutBuffer.trim()) processLine(stdoutBuffer);

	result.exitCode = spawnError ? 1 : (closedWith.code ?? 1);
	if (closedWith.signal) result.signal = closedWith.signal;
	if (spawnError) result.failureMessage = `Failed to spawn or communicate with subagent: ${spawnError}`;
	else if (aborted) result.failureMessage = "Subagent was aborted.";
	else if (closedWith.signal) result.failureMessage = `Subagent exited on signal ${closedWith.signal}.`;
	else if (result.exitCode !== 0) result.failureMessage = `Subagent exited with code ${result.exitCode}.`;
	else if (modelFailure(result.stopReason)) {
		result.failureMessage = `Subagent model stopped with reason ${result.stopReason}.`;
	} else if (!sawJson && result.malformedStdout.trim()) {
		result.failureMessage = "Subagent stdout contained no JSON events.";
	}
	return result;
}
