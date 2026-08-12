import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  ACCEPT_HEADERS,
  DEFAULT_TIMEOUT_SECONDS,
  MAX_ERROR_EXCERPT_BYTES,
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_LINES,
  MAX_RESPONSE_BYTES,
  MAX_TIMEOUT_SECONDS,
  REQUEST_HEADERS,
  boundWebFetchOutput,
  buildWebFetchToolResult,
  fetchWeb,
  normalizeWebFetchInput,
} from "./fetch.ts";
import type { FetchTestOptions, WebFetchInput } from "./fetch.ts";

const OPENCODE_WEBFETCH_REFERENCE = "https://github.com/anomalyco/opencode/blob/959c8bd4981fe838df102ddb7a7974e3117e92c6/packages/opencode/src/tool/webfetch.ts";

// Literal request values from the pinned OpenCode revision above. Do not derive
// these expectations from fetch.ts: this test guards source parity.
const PINNED_OPENCODE_ACCEPT_HEADERS = {
  markdown: "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
  text: "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1",
  html: "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1",
} as const;
const PINNED_OPENCODE_REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

const piPackageDirectory = join(
  execFileSync("npm", ["root", "--global"], { encoding: "utf8" }).trim(),
  "@earendil-works/pi-coding-agent",
);
const piRuntimeModules = new Map([
  ["@earendil-works/pi-ai", "node_modules/@earendil-works/pi-ai/dist/index.js"],
  ["@earendil-works/pi-tui", "node_modules/@earendil-works/pi-tui/dist/index.js"],
  ["typebox", "node_modules/typebox/build/index.mjs"],
].map(([specifier, path]) => [specifier, pathToFileURL(join(piPackageDirectory, path)).href]));

// Node's test runner does not inherit Pi's package resolver, unlike extension loading.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = piRuntimeModules.get(specifier);
    return url === undefined ? nextResolve(specifier, context) : { url, shortCircuit: true };
  },
});

interface RegisteredWebfetchTool {
  name: string;
  description: string;
  promptSnippet: string;
  parameters: {
    required?: string[];
    properties?: Record<string, { description?: string }>;
  };
  execute(toolCallId: string, params: unknown, signal: AbortSignal): Promise<unknown>;
}

async function loadRegisteredWebfetchTool(): Promise<RegisteredWebfetchTool> {
  const { default: webFetchExtension } = await import("./index.ts");
  let registered: RegisteredWebfetchTool | undefined;
  webFetchExtension({
    registerTool(tool: unknown) {
      registered = tool as RegisteredWebfetchTool;
    },
  } as never);
  assert.ok(registered, "webfetch extension must register its tool");
  return registered;
}

function asInput(value: unknown): WebFetchInput {
  return value as WebFetchInput;
}

function encoded(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function streamResponse(chunks: Uint8Array[], init: ResponseInit = {}, closeAfterChunks = true) {
  let index = 0;
  let cancellations = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk === undefined) {
        if (closeAfterChunks) controller.close();
      } else {
        controller.enqueue(chunk);
      }
    },
    cancel() {
      cancellations++;
    },
  });
  return { response: new Response(body, init), body, cancellations: () => cancellations };
}

class FakeClock {
  private nextHandle = 1;
  private timers = new Map<ReturnType<typeof setTimeout>, { callback: () => void; delay: number }>();
  readonly scheduled: number[] = [];
  readonly cleared: number[] = [];

  readonly setTimeout = (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const handle = { fakeTimer: this.nextHandle++ } as unknown as ReturnType<typeof setTimeout>;
    this.timers.set(handle, { callback, delay });
    this.scheduled.push(delay);
    return handle;
  };

  readonly clearTimeout = (handle: ReturnType<typeof setTimeout>): void => {
    const timer = this.timers.get(handle);
    if (timer) this.cleared.push(timer.delay);
    this.timers.delete(handle);
  };

  fire(delay: number): void {
    const entry = [...this.timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected a pending ${delay} ms timer`);
    this.timers.delete(entry[0]);
    entry[1].callback();
  }

  pending(): number {
    return this.timers.size;
  }
}

function testOptions(fetch: FetchTestOptions["fetch"], clock = new FakeClock()) {
  return {
    clock,
    options: { fetch, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout },
  };
}

function trackAbortListeners(signal: AbortSignal): { additions: () => number; removals: () => number } {
  const originalAdd = signal.addEventListener.bind(signal);
  const originalRemove = signal.removeEventListener.bind(signal);
  let additions = 0;
  let removals = 0;
  signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => {
    if (args[0] === "abort") additions++;
    return originalAdd(...args);
  }) as AbortSignal["addEventListener"];
  signal.removeEventListener = ((...args: Parameters<AbortSignal["removeEventListener"]>) => {
    if (args[0] === "abort") removals++;
    return originalRemove(...args);
  }) as AbortSignal["removeEventListener"];
  return { additions: () => additions, removals: () => removals };
}

test("normalizes defaults and permits HTTP(S), localhost, and private destinations", () => {
  assert.deepEqual(normalizeWebFetchInput({ url: "https://example.com/docs" }), {
    url: "https://example.com/docs",
    format: "markdown",
    timeout: DEFAULT_TIMEOUT_SECONDS,
  });
  for (const url of ["http://localhost:3000/", "https://127.0.0.1/", "http://192.168.1.1/"]) {
    assert.equal(normalizeWebFetchInput({ url }).url, url);
  }
});

test("rejects invalid input without adding a destination deny-list", () => {
  for (const input of [
    null,
    {},
    { url: "" },
    { url: " \t" },
    { url: "not a URL" },
    { url: "file:///tmp/a" },
    { url: "https://user:password@example.com/" },
  ]) {
    assert.throws(() => normalizeWebFetchInput(asInput(input)), /url|Web fetch input/);
  }
  for (const value of ["xml", "", 1]) {
    assert.throws(() => normalizeWebFetchInput(asInput({ url: "https://example.com/", format: value })), /format/);
  }
  for (const value of [0, -1, MAX_TIMEOUT_SECONDS + 1, NaN, Infinity, "30"]) {
    assert.throws(() => normalizeWebFetchInput(asInput({ url: "https://example.com/", timeout: value })), /timeout/);
  }
});

test(`uses OpenCode ${OPENCODE_WEBFETCH_REFERENCE} negotiated and browser-like request headers`, async () => {
  assert.deepEqual(ACCEPT_HEADERS, PINNED_OPENCODE_ACCEPT_HEADERS);
  assert.deepEqual(REQUEST_HEADERS, PINNED_OPENCODE_REQUEST_HEADERS);

  for (const format of ["markdown", "text", "html"] as const) {
    let call: { input: string | URL | Request; init?: RequestInit } | undefined;
    const { options } = testOptions(async (input, init) => {
      call = { input, init };
      return new Response("ok", { headers: { "Content-Type": "text/plain" } });
    });

    await fetchWeb({ url: "https://example.com/", format }, undefined, options);
    assert.equal(call?.input, "https://example.com/");
    assert.deepEqual(call?.init?.headers, {
      ...PINNED_OPENCODE_REQUEST_HEADERS,
      Accept: PINNED_OPENCODE_ACCEPT_HEADERS[format],
    });
    assert.ok(call?.init?.signal instanceof AbortSignal);
  }
});

test("converts HTML to Markdown and text using OpenCode's removals", async () => {
  const html = [
    "<html><head><meta name=secret content=nope><link href=bad><style>.hidden{}</style><script>bad()</script></head>",
    "<body><h2>Heading</h2><p>Hello <em>world</em>.</p><ul><li>one</li></ul>",
    "<noscript>noscript</noscript><iframe>iframe</iframe><object>object</object><embed src=media></body></html>",
  ].join("");
  const fetchHtml = async () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const markdown = await fetchWeb({ url: "https://example.com/", format: "markdown" }, undefined, { fetch: fetchHtml });
  assert.match(markdown.text, /## Heading/);
  assert.match(markdown.text, /Hello \*world\*\./);
  assert.match(markdown.text, /-\s+one/);
  for (const removed of ["bad()", ".hidden"]) assert.equal(markdown.text.includes(removed), false);

  const text = await fetchWeb({ url: "https://example.com/", format: "text" }, undefined, { fetch: fetchHtml });
  assert.equal(text.text, "HeadingHello world.one");
  for (const removed of ["bad()", ".hidden", "noscript", "iframe", "object", "embed"]) assert.equal(text.text.includes(removed), false);

  const xhtml = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><h1>XHTML heading</h1><p>Body</p></body></html>";
  const fetchXhtml = async () => new Response(xhtml, {
    headers: { "Content-Type": "Application/XHTML+XML; charset=utf-8" },
  });
  const xhtmlMarkdown = await fetchWeb({ url: "https://example.com/xhtml", format: "markdown" }, undefined, { fetch: fetchXhtml });
  assert.match(xhtmlMarkdown.text, /# XHTML heading/);
  assert.match(xhtmlMarkdown.text, /Body/);

  const xhtmlText = await fetchWeb({ url: "https://example.com/xhtml", format: "text" }, undefined, { fetch: fetchXhtml });
  assert.equal(xhtmlText.text, "XHTML headingBody");
});

test("passes raw HTML and non-HTML content through unchanged", async () => {
  const html = "<p>Hello <b>world</b></p>";
  const raw = await fetchWeb({ url: "https://example.com/", format: "html" }, undefined, {
    fetch: async () => new Response(html, { headers: { "Content-Type": "text/html" } }),
  });
  assert.equal(raw.text, html);

  for (const format of ["markdown", "text", "html"] as const) {
    const result = await fetchWeb({ url: "https://example.com/file.md", format }, undefined, {
      fetch: async () => new Response("# unchanged", { headers: { "Content-Type": "text/markdown" } }),
    });
    assert.equal(result.text, "# unchanged");
  }
});

test("rejects non-textual content types before decoding their bodies", async () => {
  for (const contentType of ["application/pdf", "image/vnd.fastbidsheet", "application/zip", "application/octet-stream"]) {
    const fixture = streamResponse([new Uint8Array([0xff, 0xd8, 0xff])], {
      headers: { "Content-Type": contentType },
    }, false);
    await assert.rejects(
      fetchWeb({ url: "https://example.com/binary" }, undefined, { fetch: async () => fixture.response }),
      new RegExp(`^Error: Web fetch unsupported content type: ${contentType.replace("+", "\\+")}$`),
    );
    assert.equal(fixture.cancellations(), 1);
    assert.equal(fixture.body.locked, false);
  }

  const missing = streamResponse([new Uint8Array([0xff])], {}, false);
  await assert.rejects(
    fetchWeb({ url: "https://example.com/no-content-type" }, undefined, { fetch: async () => missing.response }),
    /^Error: Web fetch unsupported content type: \(missing\)$/,
  );
  assert.equal(missing.cancellations(), 1);
  assert.equal(missing.body.locked, false);
});

test("retrieves a local HTTP response through the real Fetch transport", async (context) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<h1>Local fixture</h1><script>removed()</script>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const result = await fetchWeb({
    url: `http://127.0.0.1:${address.port}/fixture`,
    format: "markdown",
  });
  assert.equal(result.finalUrl, `http://127.0.0.1:${address.port}/fixture`);
  assert.equal(result.text, "# Local fixture");
  assert.ok(result.responseBytes > 0);
});

test("registered tool returns raster image blocks and SVG text from a local HTTP fixture", async (context) => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>hello</text></svg>';
  const server = createServer((request, response) => {
    if (request.url === "/image.png") {
      response.writeHead(200, { "Content-Type": "IMAGE/PNG; charset=binary" });
      response.end(png);
      return;
    }
    response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
    response.end(svg);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const tool = await loadRegisteredWebfetchTool();
  assert.equal(tool.name, "webfetch");
  assert.match(tool.description, /raster image/);
  assert.match(tool.promptSnippet, /raster image/);
  assert.deepEqual(tool.parameters.required, ["url"]);
  for (const parameter of ["url", "format", "timeout"]) {
    assert.equal(typeof tool.parameters.properties?.[parameter]?.description, "string");
  }

  const image = await tool.execute("image-fixture", { url: `${baseUrl}/image.png` }, new AbortController().signal);
  assert.deepEqual(image, {
    content: [
      { type: "text", text: "Image fetched successfully" },
      { type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" },
    ],
    details: {
      url: `${baseUrl}/image.png`,
      finalUrl: `${baseUrl}/image.png`,
      format: "markdown",
      contentType: "IMAGE/PNG; charset=binary",
      responseBytes: png.byteLength,
      outputBytes: 26,
      truncated: false,
    },
  });
  assert.equal(JSON.stringify(image).includes(Buffer.from(png).toString("base64")), true);
  assert.equal(JSON.stringify((image as { details: unknown }).details).includes(Buffer.from(png).toString("base64")), false);

  const text = await tool.execute("svg-fixture", { url: `${baseUrl}/image.svg`, format: "html" }, new AbortController().signal);
  assert.deepEqual(text, {
    content: [{ type: "text", text: svg }],
    details: {
      url: `${baseUrl}/image.svg`,
      finalUrl: `${baseUrl}/image.svg`,
      format: "html",
      contentType: "image/svg+xml; charset=utf-8",
      responseBytes: Buffer.byteLength(svg),
      outputBytes: Buffer.byteLength(svg),
      truncated: false,
    },
  });
});

test("retries exactly one Cloudflare challenge with OpenCode's user agent", async () => {
  const first = streamResponse([encoded("challenge")], {
    status: 403,
    headers: { "cf-mitigated": "challenge" },
  }, false);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const second = streamResponse([png], { headers: { "Content-Type": "image/png" } });
  const requests: RequestInit[] = [];
  const result = await fetchWeb({ url: "https://example.com/image", format: "markdown" }, undefined, {
    fetch: async (_input, init) => {
      requests.push(init!);
      return requests.length === 1 ? first.response : second.response;
    },
  });

  assert.deepEqual(requests.map((request) => request.headers), [
    { ...REQUEST_HEADERS, Accept: ACCEPT_HEADERS.markdown },
    { ...REQUEST_HEADERS, "User-Agent": "opencode", Accept: ACCEPT_HEADERS.markdown },
  ]);
  assert.equal(requests[0]?.signal, requests[1]?.signal);
  assert.equal(first.cancellations(), 1);
  assert.equal(first.body.locked, false);
  assert.equal(second.body.locked, false);
  assert.deepEqual(result, {
    finalUrl: "https://example.com/image",
    contentType: "image/png",
    image: { data: Buffer.from(png).toString("base64"), mimeType: "image/png" },
    responseBytes: png.byteLength,
  });
});

test("does not retry non-challenges or a failed challenge retry", async () => {
  const nonChallenge = streamResponse([encoded("blocked")], { status: 403 });
  let calls = 0;
  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, undefined, {
      fetch: async () => {
        calls++;
        return nonChallenge.response;
      },
    }),
    /^Error: Web fetch failed with HTTP 403: blocked$/,
  );
  assert.equal(calls, 1);
  assert.equal(nonChallenge.body.locked, false);

  const challenge = streamResponse([encoded("challenge")], {
    status: 403,
    headers: { "cf-mitigated": "challenge" },
  }, false);
  const failedRetry = streamResponse([encoded("unavailable")], { status: 503 });
  calls = 0;
  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, undefined, {
      fetch: async () => {
        calls++;
        return calls === 1 ? challenge.response : failedRetry.response;
      },
    }),
    /^Error: Web fetch failed with HTTP 503: unavailable$/,
  );
  assert.equal(calls, 2);
  assert.equal(challenge.cancellations(), 1);
  assert.equal(challenge.body.locked, false);
  assert.equal(failedRetry.body.locked, false);
});

test("preserves caller cancellation and the original deadline during a Cloudflare retry", async () => {
  for (const kind of ["caller", "timeout"] as const) {
    const challenge = streamResponse([encoded("challenge")], {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    }, false);
    const caller = new AbortController();
    let calls = 0;
    const { clock, options } = testOptions((_input, init) => {
      calls++;
      if (calls === 1) return Promise.resolve(challenge.response);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    const promise = fetchWeb({ url: "https://example.com/", timeout: 1 }, caller.signal, options);
    while (calls < 2) await new Promise<void>((resolve) => setImmediate(resolve));

    if (kind === "caller") caller.abort("stop");
    else clock.fire(1_000);

    await assert.rejects(
      promise,
      kind === "caller" ? /^Error: Web fetch cancelled by caller$/ : /^Error: Web fetch timed out after 1 seconds$/,
    );
    assert.equal(challenge.cancellations(), 1);
    assert.equal(challenge.body.locked, false);
    assert.equal(clock.pending(), 0);
  }
});

test("reports the final URL after a local redirect", async (context) => {
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/final" });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("redirected");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const result = await fetchWeb({
    url: `http://127.0.0.1:${address.port}/redirect`,
    format: "text",
  });
  assert.equal(result.finalUrl, `http://127.0.0.1:${address.port}/final`);
  assert.equal(result.text, "redirected");
});

test("reports bounded, sanitized HTTP and network diagnostics", async () => {
  const marker = "must-not-appear";
  const fixture = streamResponse([
    encoded(` upstream\nfailed\u0000 ${"x".repeat(MAX_ERROR_EXCERPT_BYTES)}${marker}`),
  ], { status: 503 }, false);
  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, undefined, { fetch: async () => fixture.response }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Web fetch failed with HTTP 503: upstream failed /);
      assert.equal(error.message.includes("\n"), false);
      assert.equal(error.message.includes(marker), false);
      return true;
    },
  );
  assert.equal(fixture.cancellations(), 1);
  assert.equal(fixture.body.locked, false);

  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, undefined, {
      fetch: async () => {
        throw new TypeError("DNS\nfailed");
      },
    }),
    /^Error: Web fetch network failure: DNS failed$/,
  );
});

test("rejects declared and streamed response bodies above 5 MiB", async () => {
  let readerRequests = 0;
  let cancellations = 0;
  const body = {
    locked: false,
    cancel: async () => { cancellations++; },
    getReader: () => {
      readerRequests++;
      throw new Error("body must not be read");
    },
  };
  const declared = {
    ok: true,
    status: 200,
    headers: new Headers({
      "Content-Length": String(MAX_RESPONSE_BYTES + 1),
      "Content-Type": "text/plain",
    }),
    body,
    url: "https://example.com/",
  } as unknown as Response;
  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, undefined, { fetch: async () => declared }),
    /^Error: Web fetch response exceeded 5 MiB$/,
  );
  assert.equal(readerRequests, 0);
  assert.equal(cancellations, 1);

  const streamed = streamResponse([new Uint8Array(MAX_RESPONSE_BYTES), new Uint8Array([1])], {
    headers: { "Content-Type": "text/plain" },
  }, false);
  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, undefined, { fetch: async () => streamed.response }),
    /^Error: Web fetch response exceeded 5 MiB$/,
  );
  assert.equal(streamed.cancellations(), 1);
  assert.equal(streamed.body.locked, false);
});

test("keeps output within byte and line limits with one UTF-8-safe notice", () => {
  for (const source of ["x".repeat(MAX_OUTPUT_BYTES), Array.from({ length: MAX_OUTPUT_LINES }, () => "x").join("\n")]) {
    assert.equal(boundWebFetchOutput(source).truncated, false);
  }

  const source = "🙂".repeat(Math.ceil(MAX_OUTPUT_BYTES / 4) + 10);
  const output = boundWebFetchOutput(source);
  assert.equal(output.truncated, true);
  assert.ok(output.outputBytes <= MAX_OUTPUT_BYTES);
  assert.ok(output.text.split(/\r\n|\r|\n/).length <= MAX_OUTPUT_LINES);
  assert.equal(output.text.match(/\[Web fetch output truncated:/g)?.length, 1);
  assert.equal(output.text.includes("�"), false);
  const retained = output.text.slice(0, output.text.indexOf("\n\n[Web fetch output truncated:"));
  assert.ok(source.startsWith(retained));

  const lineOverflow = boundWebFetchOutput(
    Array.from({ length: MAX_OUTPUT_LINES + 1 }, () => "x").join("\n"),
  );
  assert.equal(lineOverflow.truncated, true);
  assert.ok(lineOverflow.text.split(/\r\n|\r|\n/).length <= MAX_OUTPUT_LINES);
  assert.equal(lineOverflow.text.match(/\[Web fetch output truncated:/g)?.length, 1);
});

test("returns compact tool details without fetched content", () => {
  const input = normalizeWebFetchInput({ url: "https://example.com/source", format: "text" });
  const result = buildWebFetchToolResult(input, {
    finalUrl: "https://example.com/final",
    contentType: "text/plain; charset=utf-8",
    text: "unique-source-marker",
    responseBytes: 321,
  });
  assert.deepEqual(result, {
    content: [{ type: "text", text: "unique-source-marker" }],
    details: {
      url: "https://example.com/source",
      finalUrl: "https://example.com/final",
      format: "text",
      contentType: "text/plain; charset=utf-8",
      responseBytes: 321,
      outputBytes: 20,
      truncated: false,
    },
  });
  assert.equal(JSON.stringify(result.details).includes("unique-source-marker"), false);
});

test("distinguishes caller cancellation and a full-operation timeout", async () => {
  const caller = new AbortController();
  caller.abort("stop");
  let calls = 0;
  await assert.rejects(
    fetchWeb({ url: "https://example.com/" }, caller.signal, {
      fetch: async () => {
        calls++;
        return new Response();
      },
    }),
    /^Error: Web fetch cancelled by caller$/,
  );
  assert.equal(calls, 0);

  const { clock, options } = testOptions((_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  const promise = fetchWeb({ url: "https://example.com/", timeout: 1 }, undefined, options);
  clock.fire(1_000);
  await assert.rejects(promise, /^Error: Web fetch timed out after 1 seconds$/);
  assert.deepEqual(clock.scheduled, [1_000]);
  assert.equal(clock.pending(), 0);
});

test("caller cancellation while reading cancels and unlocks the body", async () => {
  const reading = Promise.withResolvers<void>();
  let cancellations = 0;
  const body = new ReadableStream<Uint8Array>({
    pull() {
      reading.resolve();
    },
    cancel() {
      cancellations++;
    },
  });
  const caller = new AbortController();
  const promise = fetchWeb({ url: "https://example.com/" }, caller.signal, {
    fetch: async () => new Response(body, { headers: { "Content-Type": "text/plain" } }),
  });

  await reading.promise;
  caller.abort("user stopped");
  await assert.rejects(promise, /^Error: Web fetch cancelled by caller$/);
  assert.equal(cancellations, 1);
  assert.equal(body.locked, false);
});

test("timeout while reading cancels and unlocks the body", async () => {
  const reading = Promise.withResolvers<void>();
  let cancellations = 0;
  const body = new ReadableStream<Uint8Array>({
    pull() {
      reading.resolve();
    },
    cancel() {
      cancellations++;
    },
  });
  const { clock, options } = testOptions(async () => new Response(body, {
    headers: { "Content-Type": "text/plain" },
  }));
  const promise = fetchWeb({ url: "https://example.com/", timeout: 1 }, undefined, options);

  await reading.promise;
  clock.fire(1_000);
  await assert.rejects(promise, /^Error: Web fetch timed out after 1 seconds$/);
  assert.equal(cancellations, 1);
  assert.equal(body.locked, false);
  assert.equal(clock.pending(), 0);
});

test("cleans up the deadline and caller listener after a successful streamed response", async () => {
  const caller = new AbortController();
  const callerListeners = trackAbortListeners(caller.signal);
  const fixture = streamResponse([encoded("ok")], { headers: { "Content-Type": "text/plain" } });
  const { clock, options } = testOptions(async () => fixture.response);
  const result = await fetchWeb({ url: "https://example.com/" }, caller.signal, options);
  assert.equal(result.text, "ok");
  assert.equal(fixture.body.locked, false);
  assert.equal(callerListeners.additions(), 1);
  assert.equal(callerListeners.removals(), 1);
  assert.deepEqual(clock.cleared, [DEFAULT_TIMEOUT_SECONDS * 1_000]);
  assert.equal(clock.pending(), 0);
});

test("accepts exact declared and streamed 5 MiB bodies and stops at the first extra byte", async () => {
  const exact = streamResponse([new Uint8Array(MAX_RESPONSE_BYTES)], {
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": String(MAX_RESPONSE_BYTES),
    },
  });
  const exactResult = await fetchWeb({ url: "https://example.com/exact" }, undefined, {
    fetch: async () => exact.response,
  });
  assert.equal(exactResult.responseBytes, MAX_RESPONSE_BYTES);
  assert.equal(exact.cancellations(), 0);
  assert.equal(exact.body.locked, false);

  let reads = 0;
  let cancellations = 0;
  let released = 0;
  const chunks = [new Uint8Array(MAX_RESPONSE_BYTES), new Uint8Array([1]), new Uint8Array([2])];
  const body = {
    locked: false,
    getReader() {
      body.locked = true;
      return {
        async read() {
          const value = chunks[reads++];
          return value === undefined ? { done: true, value: undefined } : { done: false, value };
        },
        async cancel() { cancellations++; },
        releaseLock() { body.locked = false; released++; },
      };
    },
  };
  const response = {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "text/plain" }),
    body,
    url: "https://example.com/over",
  } as unknown as Response;
  await assert.rejects(
    fetchWeb({ url: "https://example.com/over" }, undefined, { fetch: async () => response }),
    /^Error: Web fetch response exceeded 5 MiB$/,
  );
  assert.equal(reads, 2);
  assert.equal(cancellations, 1);
  assert.equal(released, 1);
  assert.equal(body.locked, false);
});

test("enforces the decoded 5 MiB boundary after gzip decompression", async (context) => {
  const server = createServer((request, response) => {
    const size = request.url === "/exact" ? MAX_RESPONSE_BYTES : MAX_RESPONSE_BYTES + 1;
    const compressed = gzipSync(Buffer.alloc(size, 0x78));
    response.writeHead(200, {
      "Content-Type": "text/plain",
      "Content-Encoding": "gzip",
      "Content-Length": compressed.byteLength,
    });
    response.end(compressed);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const exact = await fetchWeb({ url: `${baseUrl}/exact`, format: "text" });
  assert.equal(exact.responseBytes, MAX_RESPONSE_BYTES);
  await assert.rejects(
    fetchWeb({ url: `${baseUrl}/over`, format: "text" }),
    /^Error: Web fetch response exceeded 5 MiB$/,
  );
});

test("keeps output byte and line boundaries exact with one notice inside the cap", () => {
  for (const bytes of [MAX_OUTPUT_BYTES - 1, MAX_OUTPUT_BYTES]) {
    const output = boundWebFetchOutput("x".repeat(bytes));
    assert.equal(output.truncated, false);
    assert.equal(output.outputBytes, bytes);
  }
  for (const lines of [MAX_OUTPUT_LINES - 1, MAX_OUTPUT_LINES]) {
    const output = boundWebFetchOutput(Array.from({ length: lines }, () => "x").join("\n"));
    assert.equal(output.truncated, false);
    assert.equal(output.originalLines, lines);
  }

  const byteOverflow = boundWebFetchOutput("x".repeat(MAX_OUTPUT_BYTES + 1));
  assert.equal(byteOverflow.truncated, true);
  assert.ok(byteOverflow.outputBytes <= MAX_OUTPUT_BYTES);
  assert.equal(byteOverflow.text.match(/\[Web fetch output truncated:/g)?.length, 1);
  assert.match(byteOverflow.text, /Fetch a narrower URL or request a more specific format/);

  const lineOverflow = boundWebFetchOutput(
    Array.from({ length: MAX_OUTPUT_LINES + 1 }, (_, index) => `line ${index}`).join("\n"),
  );
  assert.equal(lineOverflow.truncated, true);
  assert.equal(lineOverflow.retainedLines, MAX_OUTPUT_LINES - 2);
  assert.ok(lineOverflow.outputBytes <= MAX_OUTPUT_BYTES);
  assert.ok(lineOverflow.text.split(/\r\n|\r|\n/).length <= MAX_OUTPUT_LINES);
  assert.equal(lineOverflow.text.match(/\[Web fetch output truncated:/g)?.length, 1);
});

test("follows relative and cross-origin redirects and bounds redirect loops", async (context) => {
  const finalServer = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("cross-origin final");
  });
  const redirectServer = createServer((request, response) => {
    if (request.url === "/relative") {
      response.writeHead(302, { Location: "/cross-origin" });
    } else if (request.url === "/cross-origin") {
      const address = finalServer.address();
      assert.ok(address && typeof address !== "string");
      response.writeHead(302, { Location: `http://127.0.0.1:${address.port}/final` });
    } else {
      response.writeHead(302, { Location: "/loop" });
    }
    response.end();
  });
  await Promise.all([
    new Promise<void>((resolve) => finalServer.listen(0, "127.0.0.1", resolve)),
    new Promise<void>((resolve) => redirectServer.listen(0, "127.0.0.1", resolve)),
  ]);
  context.after(() => finalServer.close());
  context.after(() => redirectServer.close());
  const redirectAddress = redirectServer.address();
  const finalAddress = finalServer.address();
  assert.ok(redirectAddress && typeof redirectAddress !== "string");
  assert.ok(finalAddress && typeof finalAddress !== "string");
  const baseUrl = `http://127.0.0.1:${redirectAddress.port}`;

  const result = await fetchWeb({ url: `${baseUrl}/relative`, format: "text" });
  assert.equal(result.text, "cross-origin final");
  assert.equal(result.finalUrl, `http://127.0.0.1:${finalAddress.port}/final`);
  await assert.rejects(
    fetchWeb({ url: `${baseUrl}/loop`, timeout: 5 }),
    /^Error: Web fetch network failure:/,
  );
});

test("preserves one injected deadline while Fetch follows delayed redirects", async (context) => {
  const finalRequest = Promise.withResolvers<void>();
  const releaseFinalResponse = Promise.withResolvers<void>();
  const finalServer = createServer(async (_request, response) => {
    finalRequest.resolve();
    await releaseFinalResponse.promise;
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("too late");
  });
  const redirectServer = createServer((_request, response) => {
    const address = finalServer.address();
    assert.ok(address && typeof address !== "string");
    response.writeHead(302, { Location: `http://127.0.0.1:${address.port}/final` });
    response.end();
  });
  await Promise.all([
    new Promise<void>((resolve) => finalServer.listen(0, "127.0.0.1", resolve)),
    new Promise<void>((resolve) => redirectServer.listen(0, "127.0.0.1", resolve)),
  ]);
  context.after(() => finalServer.close());
  context.after(() => redirectServer.close());
  const redirectAddress = redirectServer.address();
  assert.ok(redirectAddress && typeof redirectAddress !== "string");

  const { clock, options } = testOptions(fetch);
  const pending = fetchWeb({
    url: `http://127.0.0.1:${redirectAddress.port}/redirect`,
    format: "text",
    timeout: 1,
  }, undefined, options);
  await finalRequest.promise;
  clock.fire(1_000);
  releaseFinalResponse.resolve();

  await assert.rejects(pending, /^Error: Web fetch timed out after 1 seconds$/);
  assert.deepEqual(clock.scheduled, [1_000]);
  assert.equal(clock.pending(), 0);
});

test("bounds HTTP diagnostics at a valid UTF-8 boundary and leaves empty errors drained", async () => {
  const marker = "must-not-appear";
  const partialCodePoint = encoded(`${"x".repeat(MAX_ERROR_EXCERPT_BYTES - 2)}🙂${marker}`);
  const oversized = streamResponse([partialCodePoint], { status: 502 }, false);
  await assert.rejects(
    fetchWeb({ url: "https://example.com/error" }, undefined, { fetch: async () => oversized.response }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Web fetch failed with HTTP 502: x+$/);
      assert.equal(error.message.includes("�"), false);
      assert.equal(error.message.includes(marker), false);
      assert.ok(Buffer.byteLength(error.message.slice(error.message.indexOf(": ") + 2)) <= MAX_ERROR_EXCERPT_BYTES);
      return true;
    },
  );
  assert.equal(oversized.cancellations(), 1);
  assert.equal(oversized.body.locked, false);

  const empty = streamResponse([], { status: 404 });
  await assert.rejects(
    fetchWeb({ url: "https://example.com/empty" }, undefined, { fetch: async () => empty.response }),
    /^Error: Web fetch failed with HTTP 404$/,
  );
  assert.equal(empty.cancellations(), 0);
  assert.equal(empty.body.locked, false);
});

test("uses the first abort at fetch and completion boundaries", async () => {
  for (const winner of ["caller", "timeout"] as const) {
    const caller = new AbortController();
    const { clock, options } = testOptions((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const promise = fetchWeb({ url: "https://example.com/", timeout: 1 }, caller.signal, options);
    if (winner === "caller") {
      caller.abort("caller first");
      clock.fire(1_000);
    } else {
      clock.fire(1_000);
      caller.abort("caller second");
    }
    await assert.rejects(
      promise,
      winner === "caller" ? /^Error: Web fetch cancelled by caller$/ : /^Error: Web fetch timed out after 1 seconds$/,
    );
    assert.equal(clock.pending(), 0);
  }

  const caller = new AbortController();
  const fixture = streamResponse([encoded("complete")], { headers: { "Content-Type": "text/plain" } });
  const result = await fetchWeb({ url: "https://example.com/complete" }, caller.signal, {
    fetch: async () => fixture.response,
  });
  caller.abort("after completion");
  assert.equal(result.text, "complete");
  assert.equal(fixture.body.locked, false);
});

test("cleans timers, caller listeners, body listeners, and locks on every tested failure class", async () => {
  type TestFetch = NonNullable<FetchTestOptions["fetch"]>;
  const assertLifecycle = async (
    testFetch: TestFetch,
    run?: (fetch: TestFetch, caller: AbortController, clock: FakeClock, options: FetchTestOptions) => Promise<unknown>,
  ) => {
    const caller = new AbortController();
    const callerListeners = trackAbortListeners(caller.signal);
    let transportListeners: ReturnType<typeof trackAbortListeners> | undefined;
    const { clock, options } = testOptions(testFetch);
    const fetch: TestFetch = async (input, init) => {
      assert.ok(init?.signal);
      transportListeners ??= trackAbortListeners(init.signal);
      return testFetch(input, init);
    };
    const execute = run ?? ((trackedFetch: TestFetch, signal: AbortController) => fetchWeb(
      { url: "https://example.com/failure" }, signal.signal, { ...options, fetch: trackedFetch },
    ));
    await assert.rejects(execute(fetch, caller, clock, options));
    assert.equal(clock.pending(), 0);
    assert.equal(callerListeners.additions(), callerListeners.removals());
    assert.equal(transportListeners?.additions(), transportListeners?.removals());
  };

  for (const makeFixture of [
    () => streamResponse([encoded("bad request")], { status: 400 }),
    () => streamResponse([encoded("binary")], { headers: { "Content-Type": "application/pdf" } }, false),
    () => streamResponse([new Uint8Array(MAX_RESPONSE_BYTES), new Uint8Array([1])], {
      headers: { "Content-Type": "text/plain" },
    }, false),
  ]) {
    const fixture = makeFixture();
    await assertLifecycle(async () => fixture.response);
    assert.equal(fixture.body.locked, false);
  }

  let declaredCancels = 0;
  const declaredBody = {
    locked: false,
    cancel: async () => { declaredCancels++; },
    getReader: () => { throw new Error("declared oversized body must not be read"); },
  };
  await assertLifecycle(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({
      "Content-Type": "text/plain",
      "Content-Length": String(MAX_RESPONSE_BYTES + 1),
    }),
    body: declaredBody,
    url: "https://example.com/declared",
  } as unknown as Response));
  assert.equal(declaredCancels, 1);
  assert.equal(declaredBody.locked, false);

  await assertLifecycle(async () => { throw new TypeError("offline"); });

  await assertLifecycle(
    async (_input, init) => new Promise<Response>((_resolve, reject) => {
      const onAbort = () => {
        init?.signal?.removeEventListener("abort", onAbort);
        reject(init?.signal?.reason);
      };
      init?.signal?.addEventListener("abort", onAbort, { once: true });
    }),
    (fetch, caller, clock, options) => {
      const pending = fetchWeb({ url: "https://example.com/fetch-wait", timeout: 1 }, caller.signal, {
        ...options,
        fetch,
      });
      clock.fire(1_000);
      return pending;
    },
  );

  const challenge = streamResponse([encoded("challenge")], {
    status: 403,
    headers: { "cf-mitigated": "challenge" },
  }, false);
  const retryFailure = streamResponse([encoded("unavailable")], { status: 503 });
  let retryCalls = 0;
  await assertLifecycle(async () => ++retryCalls === 1 ? challenge.response : retryFailure.response);
  assert.equal(challenge.cancellations(), 1);
  assert.equal(challenge.body.locked, false);
  assert.equal(retryFailure.body.locked, false);

  const cancelStarted = Promise.withResolvers<void>();
  const releaseCancel = Promise.withResolvers<void>();
  let challengeBoundaryCancels = 0;
  const challengeBoundary = new Response(new ReadableStream<Uint8Array>({
    cancel: async () => {
      challengeBoundaryCancels++;
      cancelStarted.resolve();
      await releaseCancel.promise;
    },
  }), { status: 403, headers: { "cf-mitigated": "challenge" } });
  let boundaryCalls = 0;
  await assertLifecycle(
    async () => {
      boundaryCalls++;
      return challengeBoundary;
    },
    async (fetch, caller, _clock, options) => {
      const pending = fetchWeb({ url: "https://example.com/challenge-boundary" }, caller.signal, { ...options, fetch });
      await cancelStarted.promise;
      caller.abort("stop before retry");
      releaseCancel.resolve();
      return pending;
    },
  );
  assert.equal(boundaryCalls, 1);
  assert.equal(challengeBoundaryCancels, 1);
  assert.equal(challengeBoundary.body?.locked, false);
});

test("live public webfetch smoke test", {
  skip: process.env.WEBFETCH_LIVE_TEST !== "1" ? "set WEBFETCH_LIVE_TEST=1 to fetch https://example.com/" : false,
}, async () => {
  let status: number | undefined;
  let contentType: string | null | undefined;
  const result = await fetchWeb({ url: "https://example.com/", format: "markdown" }, undefined, {
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      status = response.status;
      contentType = response.headers.get("Content-Type");
      return response;
    },
  });
  assert.equal(status, 200);
  assert.match(contentType ?? "", /^text\/html(?:;|$)/i);
  assert.ok(result.responseBytes > 0);
  assert.ok(result.text.length > 0);
});
