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
export const MAX_ATTEMPTS = 3;
export const RETRY_FALLBACK_DELAYS_MS = [500, 1_000] as const;
export const MAX_RETRY_AFTER_MS = 5_000;
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

export interface ExaSearchResult {
  text: string;
  responseBytes: number;
}

export interface BoundedSearchOutput {
  text: string;
  outputBytes: number;
  truncated: boolean;
  originalBytes: number;
  originalLines: number;
  retainedBytes: number;
  retainedLines: number;
}

export interface SearchToolDetails {
  provider: "exa";
  query: string;
  responseBytes: number;
  outputBytes: number;
  truncated: boolean;
}

export interface SearchToolResult {
  content: [{ type: "text"; text: string }];
  details: SearchToolDetails;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type TimerHandle = ReturnType<typeof setTimeout>;

/** Narrow seams used by the dependency-free transport tests. */
export interface TransportTestOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  setTimeout?: (callback: () => void, milliseconds: number) => TimerHandle;
  clearTimeout?: (handle: TimerHandle) => void;
  now?: () => number;
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

const textEncoder = new TextEncoder();

function utf8Length(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function countLines(value: string): number {
  if (value.length === 0) return 0;
  let lines = 1;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "\r") {
      if (value[index + 1] === "\n") index++;
      lines++;
    } else if (value[index] === "\n") {
      lines++;
    }
  }
  return lines;
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoded = textEncoder.encode(value);
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

function headWithinLimits(value: string, maximumBytes: number, maximumLines: number): string {
  let bytes = 0;
  let lines = value.length === 0 ? 0 : 1;
  let end = 0;

  while (end < value.length) {
    const first = value[end];
    const isCrLf = first === "\r" && value[end + 1] === "\n";
    const isLineBreak = first === "\r" || first === "\n";
    const part = isCrLf ? "\r\n" : String.fromCodePoint(value.codePointAt(end)!);
    const partBytes = utf8Length(part);
    if (bytes + partBytes > maximumBytes || (isLineBreak && lines >= maximumLines)) break;
    bytes += partBytes;
    end += part.length;
    if (isLineBreak) lines++;
  }

  return value.slice(0, end);
}

function truncationNotice(
  originalBytes: number,
  originalLines: number,
  retainedBytes: number,
  retainedLines: number,
): string {
  return `[Search output truncated: retained ${retainedBytes} of ${originalBytes} bytes and ${retainedLines} of ${originalLines} lines. Try a narrower query or lower contextMaxCharacters.]`;
}

export function boundSearchOutput(value: string): BoundedSearchOutput {
  const originalBytes = utf8Length(value);
  const originalLines = countLines(value);
  if (originalBytes <= MAX_OUTPUT_BYTES && originalLines <= MAX_OUTPUT_LINES) {
    return {
      text: value,
      outputBytes: originalBytes,
      truncated: false,
      originalBytes,
      originalLines,
      retainedBytes: originalBytes,
      retainedLines: originalLines,
    };
  }

  const separator = "\n\n";
  let sourceByteLimit = MAX_OUTPUT_BYTES;
  let retained = "";
  let notice = "";

  while (true) {
    retained = headWithinLimits(value, sourceByteLimit, MAX_OUTPUT_LINES - 2);
    const retainedBytes = utf8Length(retained);
    const retainedLines = countLines(retained);
    notice = truncationNotice(originalBytes, originalLines, retainedBytes, retainedLines);
    const outputBytes = retainedBytes + utf8Length(separator) + utf8Length(notice);
    if (outputBytes <= MAX_OUTPUT_BYTES) break;
    sourceByteLimit -= outputBytes - MAX_OUTPUT_BYTES;
  }

  const text = `${retained}${separator}${notice}`;
  return {
    text,
    outputBytes: utf8Length(text),
    truncated: true,
    originalBytes,
    originalLines,
    retainedBytes: utf8Length(retained),
    retainedLines: countLines(retained),
  };
}

export function buildSearchToolResult(query: string, result: ExaSearchResult): SearchToolResult {
  const output = boundSearchOutput(result.text);
  return {
    content: [{ type: "text", text: output.text }],
    details: {
      provider: "exa",
      query,
      responseBytes: result.responseBytes,
      outputBytes: output.outputBytes,
      truncated: output.truncated,
    },
  };
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

interface CollectedBody {
  text: string;
  bytes: number;
}

type AbortKind = "caller" | "timeout";

function validContentLength(value: string | null): bigint | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) return undefined;
  try {
    return BigInt(value.trim());
  } catch {
    return undefined;
  }
}

const HTTP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HTTP_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HTTP_WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HTTP_MONTH = `(${HTTP_MONTHS.join("|")})`;
const HTTP_WEEKDAY = `(${HTTP_WEEKDAYS.join("|")})`;
const HTTP_WEEKDAY_LONG = `(${HTTP_WEEKDAYS_LONG.join("|")})`;

function httpDateEpochMs(value: string, nowMs: number): number | undefined {
  let match = new RegExp(
    `^${HTTP_WEEKDAY}, (\\d{2}) ${HTTP_MONTH} (\\d{4}) (\\d{2}):(\\d{2}):(\\d{2}) GMT$`,
  ).exec(value);
  let weekday: number;
  let day: number;
  let month: number;
  let year: number;
  let hour: number;
  let minute: number;
  let second: number;

  if (match !== null) {
    weekday = HTTP_WEEKDAYS.indexOf(match[1]);
    day = Number(match[2]);
    month = HTTP_MONTHS.indexOf(match[3]);
    year = Number(match[4]);
    hour = Number(match[5]);
    minute = Number(match[6]);
    second = Number(match[7]);
  } else {
    match = new RegExp(
      `^${HTTP_WEEKDAY_LONG}, (\\d{2})-${HTTP_MONTH}-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}) GMT$`,
    ).exec(value);
    if (match !== null) {
      weekday = HTTP_WEEKDAYS_LONG.indexOf(match[1]);
      day = Number(match[2]);
      month = HTTP_MONTHS.indexOf(match[3]);
      const nowYear = new Date(nowMs).getUTCFullYear();
      if (!Number.isFinite(nowYear)) return undefined;
      year = Math.floor(nowYear / 100) * 100 + Number(match[4]);
      if (year > nowYear + 50) year -= 100;
      hour = Number(match[5]);
      minute = Number(match[6]);
      second = Number(match[7]);
    } else {
      match = new RegExp(
        `^${HTTP_WEEKDAY} ${HTTP_MONTH} ( [1-9]|[12]\\d|3[01]) (\\d{2}):(\\d{2}):(\\d{2}) (\\d{4})$`,
      ).exec(value);
      if (match === null) return undefined;
      weekday = HTTP_WEEKDAYS.indexOf(match[1]);
      month = HTTP_MONTHS.indexOf(match[2]);
      day = Number(match[3].trim());
      hour = Number(match[4]);
      minute = Number(match[5]);
      second = Number(match[6]);
      year = Number(match[7]);
    }
  }

  if (hour > 23 || minute > 59 || second > 59) return undefined;
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day ||
    date.getUTCDay() !== weekday) {
    return undefined;
  }
  return date.getTime();
}

export function parseRetryAfterMs(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.replace(/^[ \t]+|[ \t]+$/g, "");
  if (trimmed.length === 0) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const significant = trimmed.replace(/^0+/, "") || "0";
    const capSeconds = String(Math.ceil(MAX_RETRY_AFTER_MS / 1_000));
    if (significant.length > capSeconds.length ||
      (significant.length === capSeconds.length && significant >= capSeconds)) {
      return MAX_RETRY_AFTER_MS;
    }
    return Number(significant) * 1_000;
  }

  if (!Number.isFinite(nowMs)) return undefined;
  const dateMs = httpDateEpochMs(trimmed, nowMs);
  if (dateMs === undefined) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, dateMs - nowMs));
}

async function cancelBody(body: ReadableStream<Uint8Array> | null, reason?: unknown): Promise<void> {
  if (body === null || body.locked) return;
  try {
    await body.cancel(reason);
  } catch {
    // Cancellation is cleanup; retain the error that caused it.
  }
}

async function collectBody(
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
  signal: AbortSignal,
): Promise<CollectedBody> {
  if (body === null) return { text: "", bytes: 0 };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  let cancelPromise: Promise<void> | undefined;
  const cancelReader = (reason?: unknown): Promise<void> => {
    cancelPromise ??= reader.cancel(reason).catch(() => undefined);
    return cancelPromise;
  };
  const onAbort = () => {
    void cancelReader(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    if (signal.aborted) throw signal.reason;
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (done) break;
      if (bytes + value.byteLength > maximumBytes) {
        await cancelReader("response size limit exceeded");
        throw new Error("Exa response exceeded 256 KiB");
      }
      bytes += value.byteLength;
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return { text: parts.join(""), bytes };
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (cancelPromise !== undefined) await cancelPromise;
    reader.releaseLock();
  }
}

async function collectErrorExcerpt(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
): Promise<string> {
  if (body === null) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  let cancelPromise: Promise<void> | undefined;
  const cancelReader = (reason?: unknown): Promise<void> => {
    cancelPromise ??= reader.cancel(reason).catch(() => undefined);
    return cancelPromise;
  };
  const onAbort = () => {
    void cancelReader(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    if (signal.aborted) throw signal.reason;
    while (bytes < MAX_ERROR_EXCERPT_BYTES) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (done) break;
      const accepted = value.subarray(0, MAX_ERROR_EXCERPT_BYTES - bytes);
      bytes += accepted.byteLength;
      parts.push(decoder.decode(accepted, { stream: bytes < MAX_ERROR_EXCERPT_BYTES }));
      if (accepted.byteLength < value.byteLength || bytes === MAX_ERROR_EXCERPT_BYTES) break;
    }
    await cancelReader("HTTP error excerpt collected");
    parts.push(decoder.decode());
    return sanitizeDetail(parts.join(""));
  } finally {
    signal.removeEventListener("abort", onAbort);
    await cancelReader("HTTP error response cleanup");
    reader.releaseLock();
  }
}

function sanitizeDetail(value: string): string {
  return truncateUtf8(value.replace(/[\u0000-\u0020\u007f-\u009f]+/g, " ").trim(), MAX_ERROR_EXCERPT_BYTES);
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return sanitizeDetail(error.message);
  return sanitizeDetail(String(error));
}

function abortError(kind: AbortKind): Error {
  return new Error(kind === "timeout"
    ? "Web search timed out after 25 seconds"
    : "Web search cancelled by caller");
}

function isUsefulTransportError(error: unknown): error is Error {
  return error instanceof McpProtocolError ||
    (error instanceof Error && (
      error.message.startsWith("Exa response exceeded ") ||
      error.message.startsWith("Exa request failed with HTTP ") ||
      error.message.startsWith("Web search ")
    ));
}

function abortableDelay(
  milliseconds: number,
  signal: AbortSignal,
  setTimer: (callback: () => void, milliseconds: number) => TimerHandle,
  clearTimer: (handle: TimerHandle) => void,
): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    let timer: TimerHandle | undefined;
    let settled = false;

    const settle = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (error !== undefined) {
        if (timer !== undefined) clearTimer(timer);
        reject(error);
      } else {
        resolve();
      }
    };
    const onAbort = () => settle(signal.reason ?? new DOMException("Aborted", "AbortError"));

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    timer = setTimer(() => settle(), milliseconds);
    if (signal.aborted) onAbort();
  });
}

export async function searchExa(
  input: SearchInput,
  callerSignal?: AbortSignal,
  testOptions: TransportTestOptions = {},
): Promise<ExaSearchResult> {
  const request = buildMcpRequest(input);
  const controller = new AbortController();
  let abortKind: AbortKind | undefined;

  const abort = (kind: AbortKind, reason?: unknown) => {
    if (abortKind !== undefined) return;
    abortKind = kind;
    controller.abort(reason);
  };
  const onCallerAbort = () => abort("caller", callerSignal?.reason);
  if (callerSignal?.aborted) onCallerAbort();
  else callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

  const timeoutMs = testOptions.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const setTimer = testOptions.setTimeout ?? setTimeout;
  const clearTimer = testOptions.clearTimeout ?? clearTimeout;
  const timeout = setTimer(
    () => abort("timeout", new DOMException("Web search timeout", "TimeoutError")),
    timeoutMs,
  );

  const fetchImpl = testOptions.fetch ?? fetch;
  const now = testOptions.now ?? Date.now;
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(request),
    signal: controller.signal,
  };

  try {
    if (abortKind !== undefined) throw abortError(abortKind);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(EXA_MCP_URL, requestInit);
      } catch (error) {
        if (abortKind !== undefined) throw abortError(abortKind);
        const detail = errorDetail(error);
        throw new Error(`Web search network failure${detail.length === 0 ? "" : `: ${detail}`}`);
      }

      if (abortKind !== undefined) {
        await cancelBody(response.body, controller.signal.reason);
        throw abortError(abortKind);
      }

      if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
        await cancelBody(response.body, "HTTP 429 response will be retried");
        if (abortKind !== undefined) throw abortError(abortKind);

        const retryAfter = parseRetryAfterMs(response.headers.get("Retry-After"), now());
        const delay = retryAfter ?? RETRY_FALLBACK_DELAYS_MS[attempt];
        if (delay > 0) {
          await abortableDelay(delay, controller.signal, setTimer, clearTimer);
        }
        if (abortKind !== undefined) throw abortError(abortKind);
        continue;
      }

      if (!response.ok) {
        const excerpt = await collectErrorExcerpt(response.body, controller.signal);
        const suffix = excerpt.length === 0 ? "" : `: ${excerpt}`;
        throw new Error(`Exa request failed with HTTP ${response.status}${suffix}`);
      }

      const contentLength = validContentLength(response.headers.get("Content-Length"));
      if (contentLength !== undefined && contentLength > BigInt(MAX_RESPONSE_BYTES)) {
        await cancelBody(response.body, "response Content-Length exceeds limit");
        throw new Error("Exa response exceeded 256 KiB");
      }

      const collected = await collectBody(response.body, MAX_RESPONSE_BYTES, controller.signal);
      if (abortKind !== undefined) throw abortError(abortKind);
      return {
        text: parseMcpResponse(collected.text),
        responseBytes: collected.bytes,
      };
    }

    throw new Error("Web search failed: retry attempts exhausted without a response");
  } catch (error) {
    if (abortKind !== undefined) throw abortError(abortKind);
    if (isUsefulTransportError(error)) throw error;
    const detail = errorDetail(error);
    throw new Error(`Web search failed${detail.length === 0 ? "" : `: ${detail}`}`);
  } finally {
    clearTimer(timeout);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}
