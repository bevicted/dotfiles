import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";

import {
  DEFAULT_LIVECRAWL,
  DEFAULT_NUM_RESULTS,
  DEFAULT_SEARCH_TYPE,
  MAX_CONTEXT_CHARACTERS,
  MAX_NUM_RESULTS,
  buildSearchToolResult,
  normalizeSearchInput,
  searchExa,
} from "./mcp.ts";

const websearchSchema = Type.Object({
  query: Type.String({
    minLength: 1,
    pattern: "\\S",
    description: "Web search query",
  }),
  numResults: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: MAX_NUM_RESULTS,
    default: DEFAULT_NUM_RESULTS,
    description: "Number of search results",
  })),
  livecrawl: Type.Optional(StringEnum(["fallback", "preferred"] as const, {
    default: DEFAULT_LIVECRAWL,
    description: "Whether live crawling is a fallback or preferred",
  })),
  type: Type.Optional(StringEnum(["auto", "fast", "deep"] as const, {
    default: DEFAULT_SEARCH_TYPE,
    description: "Exa search mode",
  })),
  contextMaxCharacters: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: MAX_CONTEXT_CHARACTERS,
    description: "Maximum characters of context returned by Exa",
  })),
}, { additionalProperties: false });

export type WebsearchInput = Static<typeof websearchSchema>;

export default function webSearchExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "websearch",
    label: "Web Search",
    description: "Search the web for current or post-cutoff information. Returns Exa source URLs and excerpts for the agent to analyze, and truncates oversized output.",
    promptSnippet: "Search the web through Exa and return source URLs and excerpts",
    promptGuidelines: [
      "Use websearch for current facts and research requiring citations.",
    ],
    parameters: websearchSchema,
    async execute(_toolCallId, params, signal) {
      const input = normalizeSearchInput(params);
      const result = await searchExa(input, signal);
      return buildSearchToolResult(input.query, result);
    },
    renderCall(args, theme, context) {
      const component = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      const query = typeof args.query === "string" ? ` ${JSON.stringify(args.query)}` : "";
      component.setText(
        theme.fg("toolTitle", theme.bold("websearch")) + theme.fg("accent", query),
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
