export interface ToolResultEvent {
	toolName: string;
	details: unknown;
}

export interface ToolResultMiddlewareAPI {
	on(event: "tool_result", handler: (event: ToolResultEvent) => { isError: true } | undefined): void;
}

function hasFailedDetails(details: unknown): details is { failed: true; mode?: string } {
	return Boolean(details) && typeof details === "object" && !Array.isArray(details) && (details as { failed?: unknown }).failed === true;
}

export function isFailedToolResult(toolName: string, details: unknown): boolean {
	if (!hasFailedDetails(details)) return false;
	return toolName === "research" || (toolName === "subagent" && details.mode === "single");
}

export function registerToolResultMiddleware(pi: ToolResultMiddlewareAPI): void {
	pi.on("tool_result", (event) => (isFailedToolResult(event.toolName, event.details) ? { isError: true } : undefined));
}
