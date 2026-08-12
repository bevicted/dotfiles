import { isFailedToolResult } from "./oracle.ts";

export interface ToolResultEvent {
	toolName: string;
	details: unknown;
}

export interface ToolResultMiddlewareAPI {
	on(event: "tool_result", handler: (event: ToolResultEvent) => { isError: true } | undefined): void;
}

export function registerToolResultMiddleware(pi: ToolResultMiddlewareAPI): void {
	pi.on("tool_result", (event) => (isFailedToolResult(event.toolName, event.details) ? { isError: true } : undefined));
}
