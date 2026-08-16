import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeApiKeyStore,
  createPlatformAiApiKeyStore,
} from "../app/ai-secure-key-store.ts";

test("platform key store remains server-render safe without localStorage", async () => {
  const keyStore = createPlatformAiApiKeyStore();
  assert.equal(keyStore.security, "memory");
  assert.equal(await keyStore.getApiKey(), null);
});

test("native API key store delegates to the secure plugin without exposing secrets", async () => {
  let stored = { value: "", connectionBinding: "" };
  const keyStore = createNativeApiKeyStore({
    async save({ value, connectionBinding = "" }) {
      stored = { value, connectionBinding };
    },
    async load() {
      return stored;
    },
    async clear() {
      stored = { value: "", connectionBinding: "" };
    },
  });

  assert.equal(keyStore.security, "secure");
  assert.equal(await keyStore.getApiKey(), null);
  await keyStore.setApiKey("  secret-value  ", "provider-a");
  assert.deepEqual(stored, {
    value: "secret-value",
    connectionBinding: "provider-a",
  });
  assert.equal(await keyStore.getApiKey("provider-a"), "secret-value");
  assert.equal(await keyStore.getApiKey("provider-b"), null);
  await keyStore.removeApiKey();
  assert.equal(await keyStore.getApiKey(), null);
});

test("native API key store binds a legacy key before returning it", async () => {
  let stored = { value: "legacy-secret" };
  const writes = [];
  const keyStore = createNativeApiKeyStore({
    async save(options) {
      writes.push(options);
      stored = options;
    },
    async load() {
      return stored;
    },
    async clear() {
      stored = { value: "" };
    },
  });

  assert.equal(await keyStore.getApiKey("provider-a"), "legacy-secret");
  assert.deepEqual(writes, [{
    value: "legacy-secret",
    connectionBinding: "provider-a",
  }]);
  assert.equal(await keyStore.getApiKey("provider-b"), null);
});

test("native legacy-key migration is serialized with clear and cannot resurrect a key", async () => {
  let stored = { value: "legacy-secret" };
  let releaseLoad;
  let reportLoadStarted;
  const loadStarted = new Promise((resolve) => {
    reportLoadStarted = resolve;
  });
  const loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  const operations = [];
  const keyStore = createNativeApiKeyStore({
    async save(options) {
      operations.push("save");
      stored = options;
    },
    async load() {
      operations.push("load");
      reportLoadStarted();
      await loadGate;
      return stored;
    },
    async clear() {
      operations.push("clear");
      stored = { value: "" };
    },
  });

  const read = keyStore.getApiKey("provider-a");
  await loadStarted;
  const clear = keyStore.removeApiKey();
  await Promise.resolve();
  assert.deepEqual(operations, ["load"]);

  releaseLoad();
  assert.equal(await read, "legacy-secret");
  await clear;
  assert.deepEqual(operations, ["load", "save", "clear"]);
  assert.equal(stored.value, "");
});

test("native API key store converts plugin failures to generic errors", async () => {
  const keyStore = createNativeApiKeyStore({
    async save() {
      throw new Error("raw provider detail");
    },
    async load() {
      throw new Error("ciphertext detail");
    },
    async clear() {
      throw new Error("preference detail");
    },
  });

  await assert.rejects(
    keyStore.getApiKey(),
    (error) =>
      /Android 系统密钥库/.test(error.message) &&
      !/ciphertext/.test(error.message),
  );
  await assert.rejects(
    keyStore.setApiKey("secret-value"),
    (error) =>
      /Android 系统密钥库/.test(error.message) &&
      !/secret-value/.test(error.message),
  );
  await assert.rejects(
    keyStore.removeApiKey(),
    (error) =>
      /Android 系统密钥库/.test(error.message) &&
      !/preference/.test(error.message),
  );
});
