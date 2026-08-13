export const RESEARCH_CONTEXT_ENTRY = "research-context";

/** Evidence-free measurements for one child provider-context preparation. */
export interface ResearchContextTelemetry {
	originalBytes: number;
	deliveredBytes: number;
	originalTokenEstimate: number;
	deliveredTokenEstimate: number;
	maskedResults: number;
}

export function isResearchContextTelemetry(value: unknown): value is ResearchContextTelemetry {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const data = value as Record<string, unknown>;
	return ["originalBytes", "deliveredBytes", "originalTokenEstimate", "deliveredTokenEstimate", "maskedResults"]
		.every((key) => typeof data[key] === "number" && Number.isSafeInteger(data[key]) && data[key] >= 0);
}
