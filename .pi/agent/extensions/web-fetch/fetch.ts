import { Parser } from "htmlparser2";
import TurndownService from "turndown";

export const DEFAULT_TIMEOUT_SECONDS = 30;
export const MAX_TIMEOUT_SECONDS = 120;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 50 * 1024;
export const MAX_OUTPUT_LINES = 2_000;
export const MAX_ERROR_EXCERPT_BYTES = 1_024;

export const ACCEPT_HEADERS = {
  markdown: "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
  text: "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1",
  html: "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1",
} as const;

export const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

export type WebFetchFormat = "text" | "markdown" | "html";

export interface WebFetchInput {
  url: string;
  format?: WebFetchFormat;
  timeout?: number;
}

export interface NormalizedWebFetchInput {
  url: string;
  format: WebFetchFormat;
  timeout: number;
}

export interface WebFetchResponse {
  finalUrl: string;
  contentType: string;
  text: string;
  responseBytes: number;
}

export interface BoundedWebFetchOutput {
  text: string;
  outputBytes: number;
  truncated: boolean;
  originalBytes: number;
  originalLines: number;
  retainedBytes: number;
  retainedLines: number;
}

export interface WebFetchToolDetails {
  url: string;
  finalUrl: string;
  format: WebFetchFormat;
  contentType: string;
  responseBytes: number;
  outputBytes: number;
  truncated: boolean;
}

export interface WebFetchToolResult {
  content: [{ type: "text"; text: string }];
  details: WebFetchToolDetails;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type TimerHandle = ReturnType<typeof setTimeout>;
type AbortKind = "caller" | "timeout";

/** Narrow seams used by the dependency-free transport tests. */
export interface FetchTestOptions {
  fetch?: FetchLike;
  setTimeout?: (callback: () => void, milliseconds: number) => TimerHandle;
  clearTimeout?: (handle: TimerHandle) => void;
}

const FORMATS: readonly WebFetchFormat[] = ["text", "markdown", "html"];
const textEncoder = new TextEncoder();

function utf8Length(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function validContentLength(value: string | null): bigint | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) return undefined;
  try {
    return BigInt(value.trim());
  } catch {
    return undefined;
  }
}

function sanitizeDetail(value: string): string {
  return truncateUtf8(value.replace(/[\u0000-\u0020\u007f-\u009f]+/g, " ").trim(), MAX_ERROR_EXCERPT_BYTES);
}

function errorDetail(error: unknown): string {
  return sanitizeDetail(error instanceof Error ? error.message : String(error));
}

function abortError(kind: AbortKind, timeout: number): Error {
  return new Error(kind === "timeout"
    ? `Web fetch timed out after ${timeout} seconds`
    : "Web fetch cancelled by caller");
}

function isUsefulTransportError(error: unknown): error is Error {
  return error instanceof Error && (
    error.message.startsWith("Web fetch response exceeded ") ||
    error.message.startsWith("Web fetch failed with HTTP ") ||
    error.message.startsWith("Web fetch network failure") ||
    error.message.startsWith("Web fetch timed out") ||
    error.message.startsWith("Web fetch cancelled")
  );
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
  return `[Web fetch output truncated: retained ${retainedBytes} of ${originalBytes} bytes and ${retainedLines} of ${originalLines} lines. Fetch a narrower URL or request a more specific format.]`;
}

export function boundWebFetchOutput(value: string): BoundedWebFetchOutput {
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

export function normalizeWebFetchInput(input: WebFetchInput): NormalizedWebFetchInput {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Web fetch input must be an object");
  }
  if (typeof input.url !== "string" || input.url.trim().length === 0) {
    throw new TypeError("url must be a non-empty string");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new TypeError("url must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError("url must use http or https");
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new TypeError("url must not include credentials");
  }

  const format = input.format ?? "markdown";
  if (!FORMATS.includes(format)) {
    throw new TypeError(`format must be one of: ${FORMATS.join(", ")}`);
  }

  const timeout = input.timeout ?? DEFAULT_TIMEOUT_SECONDS;
  if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_SECONDS) {
    throw new TypeError(`timeout must be a finite number greater than 0 through ${MAX_TIMEOUT_SECONDS}`);
  }

  return { url: parsed.toString(), format, timeout };
}

function isHtml(contentType: string): boolean {
  return contentType.toLowerCase().includes("text/html");
}

export function extractTextFromHtml(html: string): string {
  let text = "";
  let skipDepth = 0;
  const parser = new Parser({
    onopentag(name) {
      if (skipDepth > 0 || ["script", "style", "noscript", "iframe", "object", "embed"].includes(name)) {
        skipDepth++;
      }
    },
    ontext(input) {
      if (skipDepth === 0) text += input;
    },
    onclosetag() {
      if (skipDepth > 0) skipDepth--;
    },
  });
  parser.write(html);
  parser.end();
  return text.trim();
}

export function convertHtmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndownService.remove(["script", "style", "meta", "link"]);
  return turndownService.turndown(html);
}

function convertContent(content: string, contentType: string, format: WebFetchFormat): string {
  if (!isHtml(contentType)) return content;
  if (format === "markdown") return convertHtmlToMarkdown(content);
  if (format === "text") return extractTextFromHtml(content);
  return content;
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
): Promise<{ text: string; bytes: number }> {
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
        throw new Error("Web fetch response exceeded 5 MiB");
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

async function collectErrorExcerpt(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<string> {
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

export async function fetchWeb(
  rawInput: WebFetchInput | NormalizedWebFetchInput,
  callerSignal?: AbortSignal,
  testOptions: FetchTestOptions = {},
): Promise<WebFetchResponse> {
  const input = normalizeWebFetchInput(rawInput);
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

  const setTimer = testOptions.setTimeout ?? setTimeout;
  const clearTimer = testOptions.clearTimeout ?? clearTimeout;
  const timeout = setTimer(
    () => abort("timeout", new DOMException("Web fetch timeout", "TimeoutError")),
    input.timeout * 1_000,
  );

  const fetchImpl = testOptions.fetch ?? fetch;
  const requestInit: RequestInit = {
    headers: {
      ...REQUEST_HEADERS,
      Accept: ACCEPT_HEADERS[input.format],
    },
    signal: controller.signal,
  };

  try {
    if (abortKind !== undefined) throw abortError(abortKind, input.timeout);

    let response: Response;
    try {
      response = await fetchImpl(input.url, requestInit);
    } catch (error) {
      if (abortKind !== undefined) throw abortError(abortKind, input.timeout);
      const detail = errorDetail(error);
      throw new Error(`Web fetch network failure${detail.length === 0 ? "" : `: ${detail}`}`);
    }

    if (abortKind !== undefined) {
      await cancelBody(response.body, controller.signal.reason);
      throw abortError(abortKind, input.timeout);
    }

    if (!response.ok) {
      const excerpt = await collectErrorExcerpt(response.body, controller.signal);
      const suffix = excerpt.length === 0 ? "" : `: ${excerpt}`;
      throw new Error(`Web fetch failed with HTTP ${response.status}${suffix}`);
    }

    const contentLength = validContentLength(response.headers.get("Content-Length"));
    if (contentLength !== undefined && contentLength > BigInt(MAX_RESPONSE_BYTES)) {
      await cancelBody(response.body, "response Content-Length exceeds limit");
      throw new Error("Web fetch response exceeded 5 MiB");
    }

    const collected = await collectBody(response.body, MAX_RESPONSE_BYTES, controller.signal);
    if (abortKind !== undefined) throw abortError(abortKind, input.timeout);
    const contentType = response.headers.get("Content-Type") ?? "";
    return {
      finalUrl: response.url || input.url,
      contentType,
      text: convertContent(collected.text, contentType, input.format),
      responseBytes: collected.bytes,
    };
  } catch (error) {
    if (abortKind !== undefined) throw abortError(abortKind, input.timeout);
    if (isUsefulTransportError(error)) throw error;
    const detail = errorDetail(error);
    throw new Error(`Web fetch failed${detail.length === 0 ? "" : `: ${detail}`}`);
  } finally {
    clearTimer(timeout);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

export function buildWebFetchToolResult(
  input: NormalizedWebFetchInput,
  response: WebFetchResponse,
): WebFetchToolResult {
  const output = boundWebFetchOutput(response.text);
  return {
    content: [{ type: "text", text: output.text }],
    details: {
      url: input.url,
      finalUrl: response.finalUrl,
      format: input.format,
      contentType: response.contentType,
      responseBytes: response.responseBytes,
      outputBytes: output.outputBytes,
      truncated: output.truncated,
    },
  };
}
