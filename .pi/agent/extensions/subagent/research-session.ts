import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	SessionManager,
	type ReadonlySessionManager,
} from "@earendil-works/pi-coding-agent";
import {
	RESEARCH_WORK_BUDGET_ENTRY,
	isResearchWorkBudgetConfiguration,
	isResearchWorkBudgetTelemetry,
	type ResearchWorkBudgetConfiguration,
	type ResearchWorkBudgetDetails,
	type ResearchWorkBudgetTelemetry,
} from "./research-budget-audit.ts";
import {
	RESEARCH_CONTEXT_ENTRY,
	isResearchContextTelemetry,
	type ResearchContextTelemetry,
} from "./research-context-audit.ts";
import {
	RESEARCH_AGENT_NAME,
	RESEARCH_MODEL,
	RESEARCH_TOOLS,
	RESEARCH_WORK_BUDGET_CALIBRATION,
	researchWorkBudget,
	type NormalizedResearchInput,
} from "./research.ts";

export const RESEARCH_MAPPING_ENTRY = "research-session";
export const RESEARCH_CHILD_ENTRY = "research-child";
export const RESEARCH_SESSION_VERSION = 1;
/** Spawn-only hint. It is accepted only after session lineage validation. */
export const RESEARCH_CHILD_ENV = "PI_RESEARCH_CHILD_SESSION_ID";
/** Required with the child ID when the parent exists only in this Pi process. */
export const RESEARCH_PARENT_ENV = "PI_RESEARCH_PARENT_SESSION_ID";

const RESEARCH_ID_PATTERN =
	/^r_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const unavailable = "Research session is unavailable for this Research ID.";

export interface ResearchSessionMetadata {
	version: typeof RESEARCH_SESSION_VERSION;
	researchId: string;
	parentSessionId: string;
	cwd: string;
	agent: typeof RESEARCH_AGENT_NAME;
	model: typeof RESEARCH_MODEL;
	tools: string[];
	createdAt: string;
}

export interface ResearchSessionMapping extends ResearchSessionMetadata {
	childSessionId: string;
	updatedAt: string;
}

export interface ResearchSessionTarget {
	researchId: string;
	childSessionId: string;
	parentSessionId: string;
	cwd: string;
	effectiveTools: string[];
	createdAt: string;
	updatedAt: string;
	resumed: boolean;
	/** Never derive this from caller input or expose it in parent content. */
	sessionFile: string;
}

export interface ResearchSessionParent extends ReadonlySessionManager {}

export interface ResearchSessionStoreOptions {
	now?: () => Date;
	newResearchId?: () => string;
}

function canonicalCwd(cwd: string): string {
	return fs.realpathSync(path.resolve(cwd));
}

function sameStrings(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function trustedTools(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every(
			(tool) =>
				typeof tool === "string" &&
				RESEARCH_TOOLS.includes(tool as (typeof RESEARCH_TOOLS)[number]),
		) &&
		new Set(value).size === value.length
	);
}

function isMetadata(value: unknown): value is ResearchSessionMetadata {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const entry = value as Record<string, unknown>;
	return (
		entry.version === RESEARCH_SESSION_VERSION &&
		typeof entry.researchId === "string" &&
		RESEARCH_ID_PATTERN.test(entry.researchId) &&
		typeof entry.parentSessionId === "string" &&
		entry.parentSessionId.length > 0 &&
		typeof entry.cwd === "string" &&
		entry.cwd.length > 0 &&
		entry.agent === RESEARCH_AGENT_NAME &&
		entry.model === RESEARCH_MODEL &&
		trustedTools(entry.tools) &&
		typeof entry.createdAt === "string"
	);
}

function isMapping(value: unknown): value is ResearchSessionMapping {
	return (
		isMetadata(value) &&
		typeof (value as Record<string, unknown>).updatedAt === "string"
	);
}

function parentIsPersisted(parent: ResearchSessionParent): boolean {
	return Boolean(parent.getSessionFile());
}

function writeBootstrap(child: SessionManager): void {
	const sessionFile = child.getSessionFile();
	if (!sessionFile) throw new Error("Research session could not be persisted.");
	const entries = [child.getHeader(), ...child.getEntries()];
	if (entries.some((entry) => entry === null))
		throw new Error("Research session could not be initialized.");
	fs.writeFileSync(
		sessionFile,
		`${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
		{ encoding: "utf8", mode: 0o600, flag: "wx" },
	);
}

/** IDs are opaque capabilities, not session IDs or filesystem names. */
export function validateResearchId(value: unknown): string {
	if (typeof value !== "string" || !RESEARCH_ID_PATTERN.test(value)) {
		throw new Error(
			"Research researchId must be a generated non-blank Research ID.",
		);
	}
	return value;
}

export function generateResearchId(): string {
	return `r_${randomUUID()}`;
}

/**
 * A spawn hint is insufficient by itself. The active session must begin with
 * the metadata that ResearchSessionStore created and agree with that session.
 * This deliberately leaves ordinary Pi sessions and generic subagents inert.
 */
export function isTrustedResearchChildSession(
	session: ReadonlySessionManager,
	childSessionId: unknown,
	inMemoryParentSessionId?: unknown,
): boolean {
	if (
		typeof childSessionId !== "string" ||
		childSessionId !== session.getSessionId()
	)
		return false;
	const header = session.getHeader();
	const first = session.getEntries()[0];
	const childFile = session.getSessionFile();
	if (
		!header ||
		header.id !== childSessionId ||
		header.cwd !== session.getCwd() ||
		!childFile
	)
		return false;
	if (
		first?.type !== "custom" ||
		first.customType !== RESEARCH_CHILD_ENTRY ||
		!isMetadata(first.data)
	)
		return false;
	const metadata = first.data;
	const parentFile = (header as unknown as { parentSession?: unknown })
		.parentSession;
	// An in-memory parent has no JSONL file to link in the child header. Its
	// generated parent-session ID is passed only by the parent-owned spawn path
	// and must exactly match the immutable child metadata.
	if (typeof parentFile !== "string" || !parentFile) {
		return (
			typeof inMemoryParentSessionId === "string" &&
			inMemoryParentSessionId === metadata.parentSessionId
		);
	}

	let parent: SessionManager;
	try {
		parent = SessionManager.open(parentFile, path.dirname(parentFile));
	} catch {
		return false;
	}
	const parentHeader = parent.getHeader();
	if (
		!parentHeader ||
		parentHeader.id !== metadata.parentSessionId ||
		parent.getSessionFile() !== parentFile ||
		path.resolve(header.parentSession) !== path.resolve(parentFile)
	)
		return false;

	// The parent-owned mapping, not the child-controlled metadata or spawn
	// environment, authorizes this exact child file. Discover by ID in the
	// parent's session directory so a copied JSONL cannot impersonate it.
	let childPaths: string[];
	try {
		childPaths = fs
			.readdirSync(parent.getSessionDir())
			.filter((file) => file.endsWith(".jsonl"))
			.map((file) => path.join(parent.getSessionDir(), file))
			.filter((file) => {
				try {
					return (
						SessionManager.open(file, parent.getSessionDir()).getSessionId() ===
						childSessionId
					);
				} catch {
					return false;
				}
			});
	} catch {
		return false;
	}
	if (
		childPaths.length !== 1 ||
		path.resolve(childPaths[0]) !== path.resolve(childFile)
	)
		return false;

	const mapping = [...parent.getEntries()]
		.reverse()
		.find(
			(entry) =>
				entry.type === "custom" &&
				entry.customType === RESEARCH_MAPPING_ENTRY &&
				isMapping(entry.data) &&
				entry.data.researchId === metadata.researchId,
		);
	if (!mapping || !isMapping(mapping.data)) return false;
	const data = mapping.data as ResearchSessionMapping & {
		childSessionId?: unknown;
	};
	return (
		data.childSessionId === childSessionId &&
		data.researchId === metadata.researchId &&
		data.parentSessionId === metadata.parentSessionId &&
		data.cwd === metadata.cwd &&
		data.agent === metadata.agent &&
		data.model === metadata.model &&
		data.createdAt === metadata.createdAt &&
		sameStrings(data.tools, metadata.tools)
	);
}

/**
 * Resolves only parent-owned custom entries. The mapping deliberately contains
 * no child path: the child is discovered by its exact ID in the parent session
 * directory, so edited input can never redirect Pi to an arbitrary session.
 */
export class ResearchSessionStore {
	private readonly now: () => Date;
	private readonly newResearchId: () => string;
	private readonly inMemory = new WeakMap<
		object,
		Map<string, ResearchSessionTarget>
	>();
	private readonly active = new Map<
		string,
		{ lockFile: string; token: string }
	>();

	constructor(options: ResearchSessionStoreOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.newResearchId = options.newResearchId ?? generateResearchId;
	}

	create(
		parent: ResearchSessionParent,
		cwd: string,
		effectiveTools: readonly string[],
	): ResearchSessionTarget {
		const canonical = canonicalCwd(cwd);
		const researchId = validateResearchId(this.newResearchId());
		const createdAt = this.now().toISOString();
		const parentSessionId = parent.getSessionId();
		const parentFile = parent.getSessionFile();
		const child = SessionManager.create(
			canonical,
			parentIsPersisted(parent) ? parent.getSessionDir() : undefined,
			parentIsPersisted(parent) ? { parentSession: parentFile } : undefined,
		);
		const metadata: ResearchSessionMetadata = {
			version: RESEARCH_SESSION_VERSION,
			researchId,
			parentSessionId,
			cwd: canonical,
			agent: RESEARCH_AGENT_NAME,
			model: RESEARCH_MODEL,
			tools: [...effectiveTools],
			createdAt,
		};
		child.appendCustomEntry(RESEARCH_CHILD_ENTRY, metadata);
		writeBootstrap(child);
		const target: ResearchSessionTarget = {
			researchId,
			childSessionId: child.getSessionId(),
			parentSessionId,
			cwd: canonical,
			effectiveTools: [...effectiveTools],
			createdAt,
			updatedAt: createdAt,
			resumed: false,
			sessionFile: child.getSessionFile() ?? "",
		};
		if (!parentIsPersisted(parent)) {
			const targets =
				this.inMemory.get(parent as object) ??
				new Map<string, ResearchSessionTarget>();
			targets.set(researchId, target);
			this.inMemory.set(parent as object, targets);
		}
		return target;
	}

	resume(
		parent: ResearchSessionParent,
		cwd: string,
		researchId: string,
		effectiveTools: readonly string[],
	): ResearchSessionTarget {
		validateResearchId(researchId);
		const canonical = canonicalCwd(cwd);
		if (!parentIsPersisted(parent)) {
			const target = this.inMemory.get(parent as object)?.get(researchId);
			if (
				!target ||
				target.parentSessionId !== parent.getSessionId() ||
				target.cwd !== canonical ||
				!sameStrings(target.effectiveTools, effectiveTools)
			) {
				throw new Error(unavailable);
			}
			return {
				...target,
				effectiveTools: [...target.effectiveTools],
				resumed: true,
			};
		}

		const mapping = this.findMapping(parent, researchId);
		if (
			!mapping ||
			mapping.parentSessionId !== parent.getSessionId() ||
			mapping.cwd !== canonical ||
			!sameStrings(mapping.tools, effectiveTools)
		) {
			throw new Error(unavailable);
		}
		let matches: Array<{ path: string; id: string }>;
		try {
			matches = (fs.readdirSync(parent.getSessionDir()) as string[])
				.filter((file) => file.endsWith(".jsonl"))
				.map((file) => path.join(parent.getSessionDir(), file))
				.filter((file) => {
					try {
						return (
							SessionManager.open(file).getSessionId() ===
							mapping.childSessionId
						);
					} catch {
						return false;
					}
				})
				.map((file) => ({ path: file, id: mapping.childSessionId }));
		} catch {
			throw new Error(unavailable);
		}
		if (matches.length !== 1) throw new Error(unavailable);
		let child: SessionManager;
		try {
			child = SessionManager.open(matches[0].path, parent.getSessionDir());
		} catch {
			throw new Error(unavailable);
		}
		const header = child.getHeader();
		const childEntries = child.getEntries();
		const firstEntry = childEntries[0];
		const metadata =
			firstEntry?.type === "custom" &&
			firstEntry.customType === RESEARCH_CHILD_ENTRY &&
			isMetadata(firstEntry.data)
				? firstEntry.data
				: undefined;
		if (
			!header ||
			header.cwd !== canonical ||
			header.parentSession !== parent.getSessionFile() ||
			!metadata ||
			metadata.researchId !== researchId ||
			metadata.parentSessionId !== parent.getSessionId() ||
			metadata.cwd !== canonical ||
			metadata.agent !== RESEARCH_AGENT_NAME ||
			metadata.model !== RESEARCH_MODEL ||
			!sameStrings(metadata.tools, effectiveTools) ||
			!sameStrings(metadata.tools, mapping.tools)
		) {
			throw new Error(unavailable);
		}
		return {
			researchId,
			childSessionId: child.getSessionId(),
			parentSessionId: parent.getSessionId(),
			cwd: canonical,
			effectiveTools: [...metadata.tools],
			createdAt: metadata.createdAt,
			updatedAt: mapping.updatedAt,
			resumed: true,
			sessionFile: matches[0].path,
		};
	}

	/**
	 * The sidecar is created atomically beside the trusted child JSONL. Unlike an
	 * in-memory mutex, O_EXCL coordinates separate Pi processes that resolve the
	 * same persisted parent mapping. It deliberately fails closed after a process
	 * crash: a dead parent can leave a live child appending the same JSONL.
	 */
	lock(target: ResearchSessionTarget): void {
		const key = `${target.parentSessionId}:${target.researchId}`;
		if (this.active.has(key))
			throw new Error(
				"Research continuation is already running for this Research ID.",
			);
		if (!target.sessionFile) throw new Error(unavailable);
		const lockFile = `${target.sessionFile}.research-lock`;
		const token = randomUUID();
		try {
			fs.writeFileSync(lockFile, JSON.stringify({ token }), {
				encoding: "utf8",
				mode: 0o600,
				flag: "wx",
			});
			this.active.set(key, { lockFile, token });
		} catch {
			throw new Error(
				"Research continuation is already running for this Research ID.",
			);
		}
	}

	release(target: ResearchSessionTarget): void {
		const key = `${target.parentSessionId}:${target.researchId}`;
		const held = this.active.get(key);
		if (!held) return;
		this.active.delete(key);
		try {
			const lock = JSON.parse(fs.readFileSync(held.lockFile, "utf8")) as {
				token?: unknown;
			};
			if (lock.token === held.token) fs.unlinkSync(held.lockFile);
		} catch {
			// Failure to release remains fail-closed; do not allow another writer.
		}
	}

	maskingTelemetry(target: ResearchSessionTarget): ResearchContextTelemetry[] {
		try {
			const child = SessionManager.open(target.sessionFile);
			return child
				.getEntries()
				.filter(
					(entry) =>
						entry.type === "custom" &&
						entry.customType === RESEARCH_CONTEXT_ENTRY &&
						isResearchContextTelemetry(entry.data),
				)
				.map((entry) => ({ ...(entry.data as ResearchContextTelemetry) }));
		} catch {
			return [];
		}
	}

	startWorkBudget(
		target: ResearchSessionTarget,
		input: NormalizedResearchInput,
	): ResearchWorkBudgetConfiguration | undefined {
		if (input.webResearch === "disabled") return undefined;
		const configuration: ResearchWorkBudgetConfiguration = {
			version: 1,
			invocationId: randomUUID(),
			effort: input.effort,
			webResearch: input.webResearch,
			configured: researchWorkBudget(input.effort),
			startedAt: this.now().toISOString(),
		};
		SessionManager.open(target.sessionFile).appendCustomEntry(
			RESEARCH_WORK_BUDGET_ENTRY,
			configuration,
		);
		return configuration;
	}

	/**
	 * Child cancellation can terminate Pi before its agent_end hook runs. Finish
	 * the latest durable snapshot in the parent so every started invocation has
	 * a final audit record and stranded count reservations cannot persist.
	 */
	finalizeWorkBudget(
		target: ResearchSessionTarget | undefined,
		invocationId: string | undefined,
	): void {
		if (!target || !invocationId) return;
		try {
			const child = SessionManager.open(target.sessionFile);
			const entries = child.getEntries();
			const configuration = [...entries]
				.reverse()
				.find(
					(entry) =>
						entry.type === "custom" &&
						entry.customType === RESEARCH_WORK_BUDGET_ENTRY &&
						isResearchWorkBudgetConfiguration(entry.data) &&
						entry.data.invocationId === invocationId,
				)?.data as ResearchWorkBudgetConfiguration | undefined;
			if (!configuration) return;
			const latest = [...entries]
				.reverse()
				.find(
					(entry) =>
						entry.type === "custom" &&
						entry.customType === RESEARCH_WORK_BUDGET_ENTRY &&
						isResearchWorkBudgetTelemetry(entry.data) &&
						entry.data.invocationId === invocationId,
				)?.data as ResearchWorkBudgetTelemetry | undefined;
			if (
				latest &&
				latest.activeReservations === 0 &&
				latest.finalized.searchCalls >= latest.reserved.searchCalls &&
				latest.finalized.fetchCalls >= latest.reserved.fetchCalls
			)
				return;
			const telemetry: ResearchWorkBudgetTelemetry = latest
				? structuredClone(latest)
				: {
						...configuration,
						configured: { ...configuration.configured },
						reserved: { searchCalls: 0, fetchCalls: 0 },
						finalized: { searchCalls: 0, fetchCalls: 0 },
						consumed: { searchCalls: 0, fetchCalls: 0, deliveredBytes: 0 },
						truncatedBytes: 0,
						blocked: { searchCalls: 0, fetchCalls: 0, exhaustedBytes: 0 },
						exhausted: {
							searchCalls: false,
							fetchCalls: false,
							deliveredBytes: false,
						},
						activeReservations: 0,
					};
			telemetry.finalized.searchCalls = telemetry.reserved.searchCalls;
			telemetry.finalized.fetchCalls = telemetry.reserved.fetchCalls;
			telemetry.activeReservations = 0;
			child.appendCustomEntry(RESEARCH_WORK_BUDGET_ENTRY, telemetry);
		} catch {
			// The child session can be deleted only after this invocation ends.
			// Details retain the bounded best-effort audit already available.
		}
	}

	workBudgetDetails(
		target: ResearchSessionTarget,
		invocationId?: string,
	): ResearchWorkBudgetDetails {
		const cumulative = {
			invocations: 0,
			reserved: { searchCalls: 0, fetchCalls: 0 },
			finalized: { searchCalls: 0, fetchCalls: 0 },
			consumed: { searchCalls: 0, fetchCalls: 0, deliveredBytes: 0 },
			truncatedBytes: 0,
			blocked: { searchCalls: 0, fetchCalls: 0, exhaustedBytes: 0 },
		};
		try {
			const child = SessionManager.open(target.sessionFile);
			const configurations: ResearchWorkBudgetConfiguration[] = [];
			const latest = new Map<string, ResearchWorkBudgetTelemetry>();
			for (const entry of child.getEntries()) {
				if (
					entry.type !== "custom" ||
					entry.customType !== RESEARCH_WORK_BUDGET_ENTRY
				)
					continue;
				if (isResearchWorkBudgetTelemetry(entry.data))
					latest.set(entry.data.invocationId, entry.data);
				else if (isResearchWorkBudgetConfiguration(entry.data))
					configurations.push(entry.data);
			}
			const all = configurations
				.map((configuration) => latest.get(configuration.invocationId))
				.filter((item): item is ResearchWorkBudgetTelemetry => Boolean(item));
			for (const item of all) {
				cumulative.invocations++;
				cumulative.reserved.searchCalls += item.reserved.searchCalls;
				cumulative.reserved.fetchCalls += item.reserved.fetchCalls;
				cumulative.finalized.searchCalls += item.finalized.searchCalls;
				cumulative.finalized.fetchCalls += item.finalized.fetchCalls;
				cumulative.consumed.searchCalls += item.consumed.searchCalls;
				cumulative.consumed.fetchCalls += item.consumed.fetchCalls;
				cumulative.consumed.deliveredBytes += item.consumed.deliveredBytes;
				cumulative.truncatedBytes += item.truncatedBytes;
				cumulative.blocked.searchCalls += item.blocked.searchCalls;
				cumulative.blocked.fetchCalls += item.blocked.fetchCalls;
				cumulative.blocked.exhaustedBytes += item.blocked.exhaustedBytes;
			}
			const invocation = all.find((item) => item.invocationId === invocationId);
			return {
				calibration: RESEARCH_WORK_BUDGET_CALIBRATION,
				...(invocation ? { invocation: structuredClone(invocation) } : {}),
				cumulative,
			};
		} catch {
			return { calibration: RESEARCH_WORK_BUDGET_CALIBRATION, cumulative };
		}
	}

	mapping(target: ResearchSessionTarget): ResearchSessionMapping {
		target.updatedAt = this.now().toISOString();
		return {
			version: RESEARCH_SESSION_VERSION,
			researchId: target.researchId,
			childSessionId: target.childSessionId,
			parentSessionId: target.parentSessionId,
			cwd: target.cwd,
			agent: RESEARCH_AGENT_NAME,
			model: RESEARCH_MODEL,
			tools: [...target.effectiveTools],
			createdAt: target.createdAt,
			updatedAt: target.updatedAt,
		};
	}

	private findMapping(
		parent: ResearchSessionParent,
		researchId: string,
	): (ResearchSessionMapping & { childSessionId: string }) | undefined {
		for (const entry of [...parent.getEntries()].reverse()) {
			if (
				entry.type !== "custom" ||
				entry.customType !== RESEARCH_MAPPING_ENTRY ||
				!isMapping(entry.data)
			)
				continue;
			const data = entry.data as ResearchSessionMapping & {
				childSessionId?: unknown;
			};
			if (
				data.researchId !== researchId ||
				typeof data.childSessionId !== "string" ||
				!data.childSessionId
			)
				continue;
			return data as ResearchSessionMapping & { childSessionId: string };
		}
		return undefined;
	}
}

export function researchSessionError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message === unavailable ||
		message.startsWith("Research continuation is") ||
		message.startsWith("Research researchId")
		? message
		: unavailable;
}

export function researchSessionMetadataForDetails(
	target: ResearchSessionTarget,
): Omit<ResearchSessionTarget, "sessionFile"> {
	const { sessionFile: _sessionFile, ...safe } = target;
	return { ...safe, effectiveTools: [...safe.effectiveTools] };
}

export function researchSessionHandoff(
	input: NormalizedResearchInput,
): Pick<
	NormalizedResearchInput,
	"task" | "context" | "files" | "webResearch" | "effort"
> {
	return {
		task: input.task,
		context: input.context,
		files: [...input.files],
		webResearch: input.webResearch,
		effort: input.effort,
	};
}
