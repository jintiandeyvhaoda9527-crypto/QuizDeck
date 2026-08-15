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
  let stored = "";
  const keyStore = createNativeApiKeyStore({
    async save({ value }) {
      stored = value;
    },
    async load() {
      return { value: stored };
    },
    async clear() {
      stored = "";
    },
  });

  assert.equal(keyStore.security, "secure");
  assert.equal(await keyStore.getApiKey(), null);
  await keyStore.setApiKey("  secret-value  ");
  assert.equal(stored, "secret-value");
  assert.equal(await keyStore.getApiKey(), "secret-value");
  await keyStore.removeApiKey();
  assert.equal(await keyStore.getApiKey(), null);
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
