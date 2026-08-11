import { spawn as nodeSpawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export const CHILD_DEPTH_ENV = "PI_SUBAGENT_DEPTH";
export const ABORT_GRACE_MS = 5_000;

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
	const parentTools = new Set(parentActiveTools.filter((tool) => tool !== "subagent"));
	const candidates = requestedTools ?? parentActiveTools;
	return [...new Set(candidates.filter((tool) => tool !== "subagent" && parentTools.has(tool)))];
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
	const spawn = options.spawn ?? (nodeSpawn as unknown as SpawnChild);
	const schedule = options.setTimeout ?? setTimeout;
	const cancelTimer = options.clearTimeout ?? clearTimeout;
	const result: ChildRunResult = {
		exitCode: 0,
		messages: [],
		stderr: "",
		malformedStdout: "",
		usage: emptyUsage(),
	};
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
