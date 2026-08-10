import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LIVECRAWL,
  DEFAULT_NUM_RESULTS,
  DEFAULT_SEARCH_TYPE,
  EXA_MCP_TOOL,
  EXA_MCP_URL,
  JSON_RPC_VERSION,
  MAX_CONTEXT_CHARACTERS,
  MAX_ERROR_EXCERPT_BYTES,
  MAX_NUM_RESULTS,
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_LINES,
  MAX_RESPONSE_BYTES,
  MCP_METHOD,
  MCP_REQUEST_ID,
  McpProtocolError,
  NO_RESULTS_TEXT,
  REQUEST_TIMEOUT_MS,
  buildMcpRequest,
  normalizeSearchInput,
  parseMcpResponse,
  searchExa,
} from "./mcp.ts";
import type { SearchInput, TransportTestOptions } from "./mcp.ts";

function success(content: unknown[], extraResult: Record<string, unknown> = {}): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { content, ...extraResult },
  });
}

function asInput(value: unknown): SearchInput {
  return value as SearchInput;
}

test("exports the approved MCP and safety constants", () => {
  assert.equal(EXA_MCP_URL, "https://mcp.exa.ai/mcp");
  assert.equal(JSON_RPC_VERSION, "2.0");
  assert.equal(MCP_REQUEST_ID, 1);
  assert.equal(MCP_METHOD, "tools/call");
  assert.equal(EXA_MCP_TOOL, "web_search_exa");
  assert.equal(NO_RESULTS_TEXT, "No search results found. Please try a different query.");
  assert.equal(REQUEST_TIMEOUT_MS, 25_000);
  assert.equal(MAX_RESPONSE_BYTES, 256 * 1024);
  assert.equal(MAX_OUTPUT_BYTES, 50 * 1024);
  assert.equal(MAX_OUTPUT_LINES, 2_000);
  assert.equal(MAX_ERROR_EXCERPT_BYTES, 1_024);
});

test("normalizes defaults while preserving the query", () => {
  assert.deepEqual(normalizeSearchInput({ query: "  current Zig release  " }), {
    query: "  current Zig release  ",
    type: DEFAULT_SEARCH_TYPE,
    numResults: DEFAULT_NUM_RESULTS,
    livecrawl: DEFAULT_LIVECRAWL,
  });
});

test("normalizes every supplied field and includes contextMaxCharacters", () => {
  assert.deepEqual(
    normalizeSearchInput({
      query: "test",
      numResults: MAX_NUM_RESULTS,
      livecrawl: "preferred",
      type: "deep",
      contextMaxCharacters: MAX_CONTEXT_CHARACTERS,
    }),
    {
      query: "test",
      type: "deep",
      numResults: 20,
      livecrawl: "preferred",
      contextMaxCharacters: 50_000,
    },
  );
});

test("rejects missing, non-string, empty, and whitespace-only queries", () => {
  for (const input of [null, {}, { query: 42 }, { query: "" }, { query: " \t\n" }]) {
    assert.throws(() => normalizeSearchInput(asInput(input)), /query|object/);
  }
});

test("rejects invalid numResults values", () => {
  for (const value of [0, 21, 1.5, NaN, Infinity, "8", null]) {
    assert.throws(
      () => normalizeSearchInput(asInput({ query: "test", numResults: value })),
      /numResults must be an integer from 1 through 20/,
    );
  }
});

test("rejects invalid contextMaxCharacters values", () => {
  for (const value of [0, 50_001, 2.5, NaN, Infinity, "10000", null]) {
    assert.throws(
      () => normalizeSearchInput(asInput({ query: "test", contextMaxCharacters: value })),
      /contextMaxCharacters must be an integer from 1 through 50000/,
    );
  }
});

test("rejects invalid enum values", () => {
  assert.throws(
    () => normalizeSearchInput(asInput({ query: "test", livecrawl: "always" })),
    /livecrawl must be one of: fallback, preferred/,
  );
  assert.throws(
    () => normalizeSearchInput(asInput({ query: "test", type: "slow" })),
    /type must be one of: auto, fast, deep/,
  );
});

test("builds the exact OpenCode-style request and omits absent context", () => {
  const request = buildMcpRequest({ query: "latest TypeScript release" });
  assert.deepEqual(request, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query: "latest TypeScript release",
        type: "auto",
        numResults: 8,
        livecrawl: "fallback",
      },
    },
  });
  assert.equal(Object.hasOwn(request.params.arguments, "contextMaxCharacters"), false);
});

test("builds a request with all explicitly supplied arguments", () => {
  assert.deepEqual(
    buildMcpRequest({
      query: "recent browser changes",
      numResults: 3,
      livecrawl: "preferred",
      type: "fast",
      contextMaxCharacters: 12_345,
    }),
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query: "recent browser changes",
          type: "fast",
          numResults: 3,
          livecrawl: "preferred",
          contextMaxCharacters: 12_345,
        },
      },
    },
  );
});

test("parses direct JSON and returns the first non-empty text unchanged", () => {
  const expected = "Title: Example\nURL: https://example.com/source\nText: source excerpt\n";
  const body = success([
    { type: "image", data: "ignored" },
    { type: "text", text: "" },
    { type: "text", text: expected },
    { type: "text", text: "later" },
  ]);
  assert.equal(parseMcpResponse(` \n${body}\n`), expected);
});

test("parses an observed Exa-style SSE response with exact URL text", () => {
  const expected = [
    "Title: Zig Programming Language",
    "URL: https://ziglang.org/",
    "Text: Zig is a general-purpose programming language and toolchain.",
  ].join("\n");
  const payload = success([{ type: "text", text: expected }]);
  const fixture = `event: message\ndata: ${payload}\n\n`;
  assert.equal(parseMcpResponse(fixture), expected);
});

test("accepts LF, CRLF, and data lines with or without one space", () => {
  const first = success([{ type: "text", text: "LF no space" }]);
  const second = success([{ type: "text", text: "CRLF space" }]);
  assert.equal(parseMcpResponse(`event: message\ndata:${first}\n`), "LF no space");
  assert.equal(parseMcpResponse(`event: message\r\ndata: ${second}\r\n`), "CRLF space");
});

test("ignores SSE metadata, comments, sentinels, and malformed events before success", () => {
  const payload = success([{ type: "text", text: "usable" }]);
  const body = [
    ": heartbeat",
    "event: message",
    "id: 2",
    "retry: 1000",
    "data: [DONE]",
    "data: not-json",
    "data: {broken",
    "data: {\"jsonrpc\":\"2.0\",\"result\":{}}",
    `data: ${payload}`,
  ].join("\n");
  assert.equal(parseMcpResponse(body), "usable");
});

test("continues past valid no-text SSE successes to find text", () => {
  const empty = success([{ type: "text", text: "" }]);
  const text = success([{ type: "text", text: "found later" }]);
  assert.equal(parseMcpResponse(`data: ${empty}\ndata: ${text}\n`), "found later");
});

test("returns the approved no-results text for empty bodies and valid empty successes", () => {
  assert.equal(parseMcpResponse(""), NO_RESULTS_TEXT);
  assert.equal(parseMcpResponse(" \r\n\t"), NO_RESULTS_TEXT);
  assert.equal(parseMcpResponse(success([])), NO_RESULTS_TEXT);
  assert.equal(parseMcpResponse(success([{ type: "text", text: "" }, { type: "other" }])), NO_RESULTS_TEXT);
  assert.equal(parseMcpResponse(`event: message\ndata: ${success([])}\ndata: [DONE]\n`), NO_RESULTS_TEXT);
});

test("rejects malformed direct JSON and non-protocol bodies", () => {
  assert.throws(() => parseMcpResponse("{not json"), /Malformed Exa MCP response: invalid JSON/);
  assert.throws(() => parseMcpResponse("ordinary text"), /Invalid Exa MCP response/);
  assert.throws(() => parseMcpResponse("event: message\ndata: [DONE]\n"), /no JSON-RPC payload/);
  assert.throws(() => parseMcpResponse("data: {broken\n"), /Malformed Exa MCP response/);
});

test("rejects structurally invalid direct and SSE envelopes", () => {
  const invalidValues = [
    "[]",
    JSON.stringify({ result: { content: [] } }),
    JSON.stringify({ jsonrpc: "1.0", result: { content: [] } }),
    JSON.stringify({ jsonrpc: "2.0", result: {} }),
    JSON.stringify({ jsonrpc: "2.0", result: { content: {} } }),
  ];
  for (const value of invalidValues) {
    assert.throws(() => parseMcpResponse(value), McpProtocolError);
  }
  assert.throws(
    () => parseMcpResponse(`data: ${JSON.stringify({ jsonrpc: "2.0", result: {} })}\n`),
    /Malformed Exa MCP response: no valid JSON-RPC payload/,
  );
});

test("surfaces JSON-RPC errors from direct JSON and SSE immediately", () => {
  const error = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    error: { code: -32603, message: "upstream unavailable" },
  });
  assert.throws(() => parseMcpResponse(error), /Exa JSON-RPC error \(-32603\): upstream unavailable/);
  assert.throws(
    () => parseMcpResponse(`data: ${success([])}\ndata: ${error}\n`),
    /Exa JSON-RPC error \(-32603\): upstream unavailable/,
  );
});

test("surfaces MCP tool errors with returned text or a generic message", () => {
  assert.throws(
    () => parseMcpResponse(success([{ type: "text", text: "query refused" }], { isError: true })),
    /Exa MCP tool error: query refused/,
  );
  assert.throws(
    () => parseMcpResponse(success([], { isError: true })),
    /^McpProtocolError: Exa MCP tool error$/,
  );
});

test("bounds upstream-controlled protocol error messages at valid UTF-8 boundaries", () => {
  const marker = "must-not-appear";
  const longMessage = `${"🙂".repeat(MAX_ERROR_EXCERPT_BYTES)}${marker}`;
  const jsonRpcError = JSON.stringify({
    jsonrpc: "2.0",
    error: { code: "x".repeat(MAX_ERROR_EXCERPT_BYTES), message: longMessage },
  });
  const mcpError = success([{ type: "text", text: longMessage }], { isError: true });

  for (const body of [jsonRpcError, mcpError]) {
    assert.throws(() => parseMcpResponse(body), (error: unknown) => {
      assert.ok(error instanceof McpProtocolError);
      assert.equal(error.message.includes(marker), false);
      assert.equal(error.message.includes("�"), false);
      assert.ok(new TextEncoder().encode(error.message).byteLength < MAX_ERROR_EXCERPT_BYTES + 100);
      return true;
    });
  }
});

interface StreamFixture {
  response: Response;
  body: ReadableStream<Uint8Array>;
  pulls: () => number;
  cancellations: () => number;
}

function streamResponse(
  chunks: Uint8Array[],
  init: ResponseInit = {},
  closeAfterChunks = true,
): StreamFixture {
  let index = 0;
  let pullCount = 0;
  let cancellationCount = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pullCount++;
      const chunk = chunks[index++];
      if (chunk === undefined) {
        if (closeAfterChunks) controller.close();
      } else controller.enqueue(chunk);
    },
    cancel() {
      cancellationCount++;
    },
  });
  return {
    response: new Response(body, init),
    body,
    pulls: () => pullCount,
    cancellations: () => cancellationCount,
  };
}

function encoded(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function transportOptions(fetchImpl: TransportTestOptions["fetch"]): {
  options: TransportTestOptions;
  fireTimeout: () => void;
  timeoutDelay: () => number | undefined;
  clearCount: () => number;
} {
  let timeoutCallback: (() => void) | undefined;
  let delay: number | undefined;
  let clears = 0;
  const handle = {} as ReturnType<typeof setTimeout>;
  return {
    options: {
      fetch: fetchImpl,
      setTimeout(callback, milliseconds) {
        timeoutCallback = callback;
        delay = milliseconds;
        return handle;
      },
      clearTimeout(actual) {
        assert.equal(actual, handle);
        clears++;
      },
    },
    fireTimeout() {
      assert.ok(timeoutCallback);
      timeoutCallback();
    },
    timeoutDelay: () => delay,
    clearCount: () => clears,
  };
}

function paddedSuccess(byteLength: number): Uint8Array {
  const payload = encoded(success([{ type: "text", text: "bounded success" }]));
  assert.ok(payload.byteLength <= byteLength);
  const result = new Uint8Array(byteLength);
  result.fill(0x20);
  result.set(payload);
  return result;
}

test("posts one exact keyless request and returns parsed text with raw byte count", async () => {
  const body = `event: message\ndata: ${success([{ type: "text", text: "URL: https://example.com/" }])}\n`;
  const fixture = streamResponse([encoded(body)]);
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  const lifecycle = transportOptions(async (input, init) => {
    calls.push({ input, init });
    return fixture.response;
  });

  const result = await searchExa({ query: "current example", numResults: 1 }, undefined, lifecycle.options);

  assert.deepEqual(result, {
    text: "URL: https://example.com/",
    responseBytes: encoded(body).byteLength,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, EXA_MCP_URL);
  assert.deepEqual(calls[0].init, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(buildMcpRequest({ query: "current example", numResults: 1 })),
    signal: calls[0].init?.signal,
  });
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
  assert.equal(fixture.body.locked, false);
  assert.equal(fixture.cancellations(), 0);
  assert.equal(lifecycle.timeoutDelay(), REQUEST_TIMEOUT_MS);
  assert.equal(lifecycle.clearCount(), 1);
});

test("accepts exactly 256 KiB and rejects the first byte beyond it", async () => {
  const exact = streamResponse([paddedSuccess(MAX_RESPONSE_BYTES)]);
  let exactCalls = 0;
  const exactResult = await searchExa({ query: "exact" }, undefined, {
    fetch: async () => {
      exactCalls++;
      return exact.response;
    },
  });
  assert.equal(exactResult.text, "bounded success");
  assert.equal(exactResult.responseBytes, MAX_RESPONSE_BYTES);
  assert.equal(exactCalls, 1);
  assert.equal(exact.cancellations(), 0);
  assert.equal(exact.body.locked, false);

  const over = streamResponse(
    [paddedSuccess(MAX_RESPONSE_BYTES), new Uint8Array([0x20])],
    {},
    false,
  );
  let overCalls = 0;
  await assert.rejects(
    searchExa({ query: "over" }, undefined, {
      fetch: async () => {
        overCalls++;
        return over.response;
      },
    }),
    /^Error: Exa response exceeded 256 KiB$/,
  );
  assert.equal(overCalls, 1);
  assert.equal(over.cancellations(), 1);
  assert.equal(over.body.locked, false);
});

test("rejects oversized valid Content-Length without reading the body", async () => {
  let cancellations = 0;
  let readerRequests = 0;
  const body = {
    locked: false,
    cancel: async () => {
      cancellations++;
    },
    getReader: () => {
      readerRequests++;
      throw new Error("body must not be read");
    },
  };
  const response = {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Length": String(MAX_RESPONSE_BYTES + 1) }),
    body,
  } as unknown as Response;
  let fetchCalls = 0;
  await assert.rejects(
    searchExa({ query: "declared over" }, undefined, {
      fetch: async () => {
        fetchCalls++;
        return response;
      },
    }),
    /Exa response exceeded 256 KiB/,
  );
  assert.equal(fetchCalls, 1);
  assert.equal(readerRequests, 0);
  assert.equal(cancellations, 1);
});

test("ignores invalid Content-Length and enforces the streamed limit", async () => {
  for (const contentLength of ["garbage", "-1", "1.5"]) {
    const fixture = streamResponse([paddedSuccess(MAX_RESPONSE_BYTES)] , {
      headers: { "Content-Length": contentLength },
    });
    const result = await searchExa({ query: contentLength }, undefined, {
      fetch: async () => fixture.response,
    });
    assert.equal(result.responseBytes, MAX_RESPONSE_BYTES);
    assert.equal(fixture.body.locked, false);
  }
});

test("bounds, sanitizes, and cancels non-2xx error bodies", async () => {
  const marker = "must-not-appear";
  const body = encoded(` upstream\nfailed\u0000 ${"x".repeat(MAX_ERROR_EXCERPT_BYTES)}${marker}`);
  const fixture = streamResponse([body], { status: 503 }, false);
  let fetchCalls = 0;

  await assert.rejects(
    searchExa({ query: "HTTP failure" }, undefined, {
      fetch: async () => {
        fetchCalls++;
        return fixture.response;
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Exa request failed with HTTP 503: upstream failed /);
      assert.equal(error.message.includes("\n"), false);
      assert.equal(error.message.includes(marker), false);
      const excerpt = error.message.slice(error.message.indexOf(": ") + 2);
      assert.ok(encoded(excerpt).byteLength <= MAX_ERROR_EXCERPT_BYTES);
      return true;
    },
  );
  assert.equal(fetchCalls, 1);
  assert.equal(fixture.cancellations(), 1);
  assert.equal(fixture.body.locked, false);
});

test("reports HTTP status without an excerpt when the error body is absent", async () => {
  await assert.rejects(
    searchExa({ query: "HTTP empty" }, undefined, {
      fetch: async () => new Response(null, { status: 404 }),
    }),
    /^Error: Exa request failed with HTTP 404$/,
  );
});

test("a pre-aborted caller prevents fetch and is reported as cancellation", async () => {
  const caller = new AbortController();
  caller.abort("stop");
  let fetchCalls = 0;
  const lifecycle = transportOptions(async () => {
    fetchCalls++;
    return new Response();
  });

  await assert.rejects(
    searchExa({ query: "cancelled" }, caller.signal, lifecycle.options),
    /^Error: Web search cancelled by caller$/,
  );
  assert.equal(fetchCalls, 0);
  assert.equal(lifecycle.clearCount(), 1);
});

test("caller cancellation while reading cancels and releases the body reader", async () => {
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let cancellations = 0;
  const reading = Promise.withResolvers<void>();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
    pull() {
      reading.resolve();
    },
    cancel() {
      cancellations++;
    },
  });
  const response = new Response(body);
  const caller = new AbortController();
  let fetchCalls = 0;
  const promise = searchExa({ query: "cancel while reading" }, caller.signal, {
    fetch: async () => {
      fetchCalls++;
      return response;
    },
  });

  await reading.promise;
  caller.abort("user stopped");
  await assert.rejects(promise, /^Error: Web search cancelled by caller$/);
  assert.equal(fetchCalls, 1);
  assert.equal(cancellations, 1);
  assert.equal(body.locked, false);
  assert.ok(streamController);
});

test("timeout aborts fetch with its distinct fixed message", async () => {
  let fetchCalls = 0;
  let fetchSignal: AbortSignal | undefined;
  const lifecycle = transportOptions((_input, init) => {
    fetchCalls++;
    fetchSignal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });
  });
  const promise = searchExa({ query: "timeout" }, undefined, lifecycle.options);
  lifecycle.fireTimeout();

  await assert.rejects(promise, /^Error: Web search timed out after 25 seconds$/);
  assert.equal(fetchCalls, 1);
  assert.equal(fetchSignal?.aborted, true);
  assert.equal(lifecycle.clearCount(), 1);
});

test("removes the caller listener and clears the timer on success and failure", async () => {
  for (const response of [
    new Response(success([{ type: "text", text: "ok" }])),
    new Response("not protocol data"),
  ]) {
    const caller = new AbortController();
    const signal = caller.signal;
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
    const lifecycle = transportOptions(async () => response);

    try {
      await searchExa({ query: "cleanup" }, signal, lifecycle.options);
    } catch (error) {
      assert.match(String(error), /Invalid Exa MCP response/);
    }
    assert.equal(additions, 1);
    assert.equal(removals, 1);
    assert.equal(lifecycle.clearCount(), 1);
    assert.equal(response.body?.locked, false);
  }
});

test("maps fetch failures and preserves protocol error categories", async () => {
  await assert.rejects(
    searchExa({ query: "network" }, undefined, {
      fetch: async () => {
        throw new TypeError("DNS lookup\nfailed");
      },
    }),
    /^Error: Web search network failure: DNS lookup failed$/,
  );

  await assert.rejects(
    searchExa({ query: "protocol" }, undefined, {
      fetch: async () => new Response("not JSON or SSE"),
    }),
    (error: unknown) => error instanceof McpProtocolError && /Invalid Exa MCP response/.test(error.message),
  );
});

test("live Exa transport smoke test", {
  skip: process.env.EXA_LIVE_TEST !== "1" ? "set EXA_LIVE_TEST=1 to call Exa" : false,
}, async () => {
  const result = await searchExa({
    query: "official Zig programming language website",
    numResults: 1,
  });
  assert.ok(result.text.length > 0);
  assert.match(result.text, /https?:\/\//);
  assert.ok(result.responseBytes > 0);
});
