import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";

import {
  DEFAULT_TIMEOUT_SECONDS,
  MAX_TIMEOUT_SECONDS,
  buildWebFetchToolResult,
  fetchWeb,
  normalizeWebFetchInput,
} from "./fetch.ts";

const webfetchSchema = Type.Object({
  url: Type.String({
    minLength: 1,
    pattern: "\\S",
    description: "Known direct HTTP(S) URL to retrieve",
  }),
  format: Type.Optional(StringEnum(["text", "markdown", "html"] as const, {
    default: "markdown",
    description: "Return format. Defaults to markdown.",
  })),
  timeout: Type.Optional(Type.Number({
    exclusiveMinimum: 0,
    maximum: MAX_TIMEOUT_SECONDS,
    default: DEFAULT_TIMEOUT_SECONDS,
    description: "Timeout in seconds. Defaults to 30; maximum 120.",
  })),
}, { additionalProperties: false });

export type WebfetchInput = Static<typeof webfetchSchema>;

export default function webFetchExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "webfetch",
    label: "Web Fetch",
    description: "Retrieve a known direct HTTP(S) URL as Markdown, plain text, raw HTML, or a raster image. Use websearch to discover a URL or source first. Responses and tool output are bounded.",
    promptSnippet: "Retrieve a known direct URL as Markdown, text, HTML, or a raster image",
    promptGuidelines: [
      "Use webfetch for a known direct URL; use websearch when the URL or source must be discovered.",
    ],
    parameters: webfetchSchema,
    async execute(_toolCallId, params, signal) {
      const input = normalizeWebFetchInput(params);
      const response = await fetchWeb(input, signal);
      return buildWebFetchToolResult(input, response);
    },
    renderCall(args, theme, context) {
      const component = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const url = typeof args.url === "string" ? ` ${JSON.stringify(args.url)}` : "";
      component.setText(
        theme.fg("toolTitle", theme.bold("webfetch")) + theme.fg("accent", url),
      );
      return component;
    },
    renderResult(result, { expanded }, theme, context) {
      const component = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const output = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      component.setText(expanded || context.isError ? `\n${theme.fg("toolOutput", output)}` : "");
      return component;
    },
  });
}
