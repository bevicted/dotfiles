import type { ResearchEffort, WebResearchMode } from "./research.ts";

export const RESEARCH_WORK_BUDGET_ENTRY = "research-work-budget";

export interface ResearchWorkBudget {
	searchCalls: number;
	fetchCalls: number;
	deliveredBytes: number;
}

/** A non-context child entry created before each Research invocation. */
export interface ResearchWorkBudgetConfiguration {
	version: 1;
	invocationId: string;
	effort: ResearchEffort;
	webResearch: Exclude<WebResearchMode, "disabled">;
	configured: ResearchWorkBudget;
	startedAt: string;
}

/** Evidence-free runtime snapshot. One is appended after every state transition. */
export interface ResearchWorkBudgetTelemetry
	extends ResearchWorkBudgetConfiguration {
	reserved: Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls">;
	finalized: Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls">;
	consumed: ResearchWorkBudget;
	truncatedBytes: number;
	blocked: Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls"> & {
		exhaustedBytes: number;
	};
	exhausted: {
		searchCalls: boolean;
		fetchCalls: boolean;
		deliveredBytes: boolean;
	};
	activeReservations: number;
}

export interface ResearchWorkBudgetDetails {
	calibration: string;
	invocation?: ResearchWorkBudgetTelemetry;
	cumulative: {
		invocations: number;
		reserved: Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls">;
		finalized: Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls">;
		consumed: ResearchWorkBudget;
		truncatedBytes: number;
		blocked: Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls"> & {
			exhaustedBytes: number;
		};
	};
}

function nonNegativeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function workBudget(value: unknown): value is ResearchWorkBudget {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const data = value as Record<string, unknown>;
	return (
		nonNegativeInteger(data.searchCalls) &&
		nonNegativeInteger(data.fetchCalls) &&
		nonNegativeInteger(data.deliveredBytes)
	);
}

function callBudget(
	value: unknown,
): value is Pick<ResearchWorkBudget, "searchCalls" | "fetchCalls"> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const data = value as Record<string, unknown>;
	return (
		nonNegativeInteger(data.searchCalls) && nonNegativeInteger(data.fetchCalls)
	);
}

export function isResearchWorkBudgetConfiguration(
	value: unknown,
): value is ResearchWorkBudgetConfiguration {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const data = value as Record<string, unknown>;
	return (
		data.version === 1 &&
		typeof data.invocationId === "string" &&
		data.invocationId.length > 0 &&
		(data.effort === "standard" || data.effort === "deep") &&
		(data.webResearch === "auto" || data.webResearch === "required") &&
		workBudget(data.configured) &&
		typeof data.startedAt === "string"
	);
}

export function isResearchWorkBudgetTelemetry(
	value: unknown,
): value is ResearchWorkBudgetTelemetry {
	if (!isResearchWorkBudgetConfiguration(value)) return false;
	const data = value as Record<string, unknown>;
	return (
		callBudget(data.reserved) &&
		callBudget(data.finalized) &&
		workBudget(data.consumed) &&
		nonNegativeInteger(data.truncatedBytes) &&
		callBudget(data.blocked) &&
		nonNegativeInteger(
			(data.blocked as Record<string, unknown>).exhaustedBytes,
		) &&
		Boolean(data.exhausted) &&
		typeof data.exhausted === "object" &&
		!Array.isArray(data.exhausted) &&
		["searchCalls", "fetchCalls", "deliveredBytes"].every(
			(key) =>
				typeof (data.exhausted as Record<string, unknown>)[key] === "boolean",
		) &&
		nonNegativeInteger(data.activeReservations)
	);
}
