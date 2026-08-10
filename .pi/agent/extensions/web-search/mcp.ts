export const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
export const JSON_RPC_VERSION = "2.0";
export const MCP_REQUEST_ID = 1;
export const MCP_METHOD = "tools/call";
export const EXA_MCP_TOOL = "web_search_exa";
export const NO_RESULTS_TEXT = "No search results found. Please try a different query.";

export const DEFAULT_NUM_RESULTS = 8;
export const MAX_NUM_RESULTS = 20;
export const DEFAULT_LIVECRAWL = "fallback";
export const DEFAULT_SEARCH_TYPE = "auto";
export const MAX_CONTEXT_CHARACTERS = 50_000;
export const REQUEST_TIMEOUT_MS = 25_000;
export const MAX_RESPONSE_BYTES = 256 * 1024;
export const MAX_OUTPUT_BYTES = 50 * 1024;
export const MAX_OUTPUT_LINES = 2_000;
export const MAX_ERROR_EXCERPT_BYTES = 1_024;

export type Livecrawl = "fallback" | "preferred";
export type SearchType = "auto" | "fast" | "deep";

export interface SearchInput {
  query: string;
  numResults?: number;
  livecrawl?: Livecrawl;
  type?: SearchType;
  contextMaxCharacters?: number;
}

export interface NormalizedSearchInput {
  query: string;
  numResults: number;
  livecrawl: Livecrawl;
  type: SearchType;
  contextMaxCharacters?: number;
}

export interface McpCallRequest {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: typeof MCP_REQUEST_ID;
  method: typeof MCP_METHOD;
  params: {
    name: typeof EXA_MCP_TOOL;
    arguments: NormalizedSearchInput;
  };
}

export class McpProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpProtocolError";
  }
}

class InvalidPayloadError extends McpProtocolError {}

const LIVECRAWL_VALUES: readonly Livecrawl[] = ["fallback", "preferred"];
const SEARCH_TYPE_VALUES: readonly SearchType[] = ["auto", "fast", "deep"];

function requireIntegerInRange(name: string, value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

export function normalizeSearchInput(input: SearchInput): NormalizedSearchInput {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Search input must be an object");
  }
  if (typeof input.query !== "string" || input.query.trim().length === 0) {
    throw new TypeError("query must be a non-empty string");
  }

  const numResults = input.numResults === undefined
    ? DEFAULT_NUM_RESULTS
    : requireIntegerInRange("numResults", input.numResults, 1, MAX_NUM_RESULTS);

  const livecrawl = input.livecrawl === undefined ? DEFAULT_LIVECRAWL : input.livecrawl;
  if (!LIVECRAWL_VALUES.includes(livecrawl)) {
    throw new TypeError(`livecrawl must be one of: ${LIVECRAWL_VALUES.join(", ")}`);
  }

  const type = input.type === undefined ? DEFAULT_SEARCH_TYPE : input.type;
  if (!SEARCH_TYPE_VALUES.includes(type)) {
    throw new TypeError(`type must be one of: ${SEARCH_TYPE_VALUES.join(", ")}`);
  }

  const normalized: NormalizedSearchInput = {
    query: input.query,
    type,
    numResults,
    livecrawl,
  };
  if (input.contextMaxCharacters !== undefined) {
    normalized.contextMaxCharacters = requireIntegerInRange(
      "contextMaxCharacters",
      input.contextMaxCharacters,
      1,
      MAX_CONTEXT_CHARACTERS,
    );
  }
  return normalized;
}

export function buildMcpRequest(input: SearchInput): McpCallRequest {
  const normalized = normalizeSearchInput(input);
  return {
    jsonrpc: JSON_RPC_VERSION,
    id: MCP_REQUEST_ID,
    method: MCP_METHOD,
    params: {
      name: EXA_MCP_TOOL,
      arguments: normalized,
    },
  };
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maximumBytes) return value;

  for (let end = maximumBytes; end > 0; end--) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(encoded.subarray(0, end));
    } catch {
      // A UTF-8 code point uses at most four bytes, so this loop retries at most three times.
    }
  }
  return "";
}

function boundedDetail(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.length === 0 ? undefined : truncateUtf8(value, MAX_ERROR_EXCERPT_BYTES);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return undefined;
}

function invalidResponse(reason: string): never {
  throw new InvalidPayloadError(`Invalid Exa MCP response: ${reason}`);
}

interface ParsedEnvelope {
  text?: string;
}

function parseEnvelope(value: unknown): ParsedEnvelope {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalidResponse("expected a JSON-RPC object");
  }

  const envelope = value as Record<string, unknown>;
  if (envelope.jsonrpc !== JSON_RPC_VERSION) {
    return invalidResponse("expected JSON-RPC version 2.0");
  }

  if (Object.hasOwn(envelope, "error")) {
    const error = envelope.error;
    if (error === null || typeof error !== "object" || Array.isArray(error)) {
      throw new McpProtocolError("Exa JSON-RPC error");
    }
    const errorObject = error as Record<string, unknown>;
    const code = boundedDetail(errorObject.code);
    const message = boundedDetail(errorObject.message);
    const codeSuffix = code === undefined ? "" : ` (${code})`;
    const messageSuffix = message === undefined ? "" : `: ${message}`;
    const detail = truncateUtf8(`${codeSuffix}${messageSuffix}`, MAX_ERROR_EXCERPT_BYTES);
    throw new McpProtocolError(`Exa JSON-RPC error${detail}`);
  }

  const result = envelope.result;
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    return invalidResponse("expected result.content");
  }
  const resultObject = result as Record<string, unknown>;
  const content = resultObject.content;

  if (resultObject.isError === true) {
    const errorText = Array.isArray(content)
      ? content.find(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item) &&
          typeof (item as Record<string, unknown>).text === "string" &&
          ((item as Record<string, unknown>).text as string).length > 0,
      )?.text
      : undefined;
    const detail = boundedDetail(errorText);
    throw new McpProtocolError(detail === undefined ? "Exa MCP tool error" : `Exa MCP tool error: ${detail}`);
  }

  if (!Array.isArray(content)) {
    return invalidResponse("expected result.content to be an array");
  }

  for (const item of content) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const text = (item as Record<string, unknown>).text;
    if (typeof text === "string" && text.length > 0) return { text };
  }
  return {};
}

function parseJsonEnvelope(payload: string): ParsedEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new InvalidPayloadError("Malformed Exa MCP response: invalid JSON");
  }
  return parseEnvelope(value);
}

export function parseMcpResponse(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return NO_RESULTS_TEXT;

  if (trimmed.startsWith("{")) {
    return parseJsonEnvelope(trimmed).text ?? NO_RESULTS_TEXT;
  }

  let sawData = false;
  let sawJsonLookingData = false;
  let sawValidSuccess = false;

  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    sawData = true;
    const payload = line.slice(5).replace(/^ /, "").trim();
    if (!payload.startsWith("{") && !payload.startsWith("[")) continue;
    if (payload === "[DONE]") continue;
    sawJsonLookingData = true;

    let parsed: ParsedEnvelope;
    try {
      parsed = parseJsonEnvelope(payload);
    } catch (error) {
      if (error instanceof InvalidPayloadError) continue;
      throw error;
    }
    sawValidSuccess = true;
    if (parsed.text !== undefined) return parsed.text;
  }

  if (sawValidSuccess) return NO_RESULTS_TEXT;
  if (sawJsonLookingData) {
    throw new McpProtocolError("Malformed Exa MCP response: no valid JSON-RPC payload");
  }
  if (sawData) {
    throw new McpProtocolError("Invalid Exa MCP response: no JSON-RPC payload");
  }
  throw new McpProtocolError("Invalid Exa MCP response: expected JSON or SSE data");
}
