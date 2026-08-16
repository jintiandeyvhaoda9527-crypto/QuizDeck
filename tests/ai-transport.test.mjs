import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_AI_HTTP_REQUEST_CHARS,
  MAX_AI_HTTP_RESPONSE_CHARS,
  AiClientError,
  createWebAiHttpTransport,
  throwForAiHttpStatus,
} from "../app/ai-transport.ts";

function headers(values = {}) {
  const entries = Object.entries(values);
  return {
    entries() {
      return entries[Symbol.iterator]();
    },
    get(name) {
      const target = name.toLowerCase();
      return entries.find(([key]) => key.toLowerCase() === target)?.[1] ??
        null;
    },
  };
}

function response({ status = 200, text = "{}", responseHeaders = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(responseHeaders),
    body: null,
    async text() {
      return text;
    },
  };
}

function replaceGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
  t.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, name, previous);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  });
}

test("Web AI transport sends bodyless GET and JSON POST with safe fetch options", async (t) => {
  const calls = [];
  replaceGlobal(t, "fetch", async (url, init) => {
    calls.push({ url, init });
    return response({
      text: JSON.stringify({ data: [{ id: "model-a" }] }),
      responseHeaders: { "x-request-id": "request-1" },
    });
  });
  const transport = createWebAiHttpTransport();
  const request = {
    url: "https://api.example.com/v1/models",
    headers: { Authorization: "Bearer secret" },
    timeoutMs: 1_000,
  };

  const getResult = await transport.getJson(request);
  const postResult = await transport.postJson({
    ...request,
    body: { model: "model-a" },
  });

  assert.equal(getResult.status, 200);
  assert.deepEqual(getResult.headers, { "x-request-id": "request-1" });
  assert.equal(postResult.status, 200);
  assert.equal(calls[0].url, request.url);
  assert.equal(calls[0].init.method, "GET");
  assert.equal("body" in calls[0].init, false);
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.body, '{"model":"model-a"}');
  for (const { init } of calls) {
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
  }
});

test("Web AI transport enforces timeout and caller cancellation", async (t) => {
  replaceGlobal(t, "fetch", (_url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(Object.assign(new Error("aborted"), {
          name: "AbortError",
        })),
        { once: true },
      );
    }),
  );
  const transport = createWebAiHttpTransport();
  await assert.rejects(
    transport.getJson({
      url: "https://api.example.com/v1/models",
      headers: {},
      timeoutMs: 5,
    }),
    (error) => error instanceof AiClientError && error.code === "timeout",
  );

  const controller = new AbortController();
  const pending = transport.getJson({
    url: "https://api.example.com/v1/models",
    headers: {},
    timeoutMs: 1_000,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(
    pending,
    (error) => error instanceof AiClientError && error.code === "cancelled",
  );
});

test("Web AI transport bounds successful responses and never reads error bodies", async (t) => {
  let textReads = 0;
  replaceGlobal(t, "fetch", async (url) => {
    if (url.endsWith("/unauthorized")) {
      return {
        ...response({ status: 401 }),
        body: {
          getReader() {
            throw new Error("error body must not be read");
          },
        },
        async text() {
          textReads += 1;
          throw new Error("error body must not be read");
        },
      };
    }
    return response({ text: "x".repeat(MAX_AI_HTTP_RESPONSE_CHARS + 1) });
  });
  const transport = createWebAiHttpTransport();

  await assert.rejects(
    transport.getJson({
      url: "https://api.example.com/v1/models",
      headers: {},
      timeoutMs: 1_000,
    }),
    (error) =>
      error instanceof AiClientError && error.code === "response-too-large",
  );
  const unauthorized = await transport.getJson({
    url: "https://api.example.com/v1/unauthorized",
    headers: { Authorization: "Bearer do-not-leak" },
    timeoutMs: 1_000,
  });
  assert.deepEqual(unauthorized, {
    status: 401,
    data: null,
    headers: {},
  });
  assert.equal(textReads, 0);
});

test("AI transport rejects oversized serialized request bodies before sending", async (t) => {
  let called = false;
  replaceGlobal(t, "fetch", async () => {
    called = true;
    return response();
  });
  const transport = createWebAiHttpTransport();
  await assert.rejects(
    transport.postJson({
      url: "https://api.example.com/v1/chat/completions",
      headers: {},
      body: { payload: "x".repeat(MAX_AI_HTTP_REQUEST_CHARS + 1) },
      timeoutMs: 1_000,
    }),
    (error) =>
      error instanceof AiClientError && error.code === "request-too-large",
  );
  assert.equal(called, false);
});

test("Fetch TypeError is browser-direct-unavailable only in a real window", async (t) => {
  replaceGlobal(t, "fetch", async () => {
    throw new TypeError("Failed to fetch secret details");
  });
  const transport = createWebAiHttpTransport();
  const request = {
    url: "https://api.example.com/v1/models",
    headers: {},
    timeoutMs: 1_000,
  };

  await assert.rejects(
    transport.getJson(request),
    (error) =>
      error instanceof AiClientError &&
      error.code === "network" &&
      !error.message.includes("secret details"),
  );

  replaceGlobal(t, "window", globalThis);
  await assert.rejects(
    transport.getJson(request),
    (error) =>
      error instanceof AiClientError &&
      error.code === "browser-direct-unavailable" &&
      /CORS/u.test(error.message) &&
      /网络/u.test(error.message) &&
      !error.message.includes("secret details"),
  );
});

test("HTTP status mapping separates authentication, permission, and discovery absence", () => {
  for (const [status, code] of [
    [401, "authentication"],
    [403, "permission-denied"],
    [404, "not-found"],
    [405, "not-found"],
  ]) {
    assert.throws(
      () => throwForAiHttpStatus(status),
      (error) =>
        error instanceof AiClientError &&
        error.code === code &&
        error.status === status,
    );
  }
  assert.doesNotThrow(() => throwForAiHttpStatus(200));
});
