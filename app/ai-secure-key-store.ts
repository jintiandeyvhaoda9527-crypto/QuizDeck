import { Capacitor, registerPlugin } from "@capacitor/core";

import {
  AiConfigurationError,
  createMemoryApiKeyStore,
  createWebPreviewApiKeyStore,
  normalizeAiApiKey,
  type AiApiKeyStore,
} from "./ai-config";

interface SecureApiKeyPlugin {
  save(options: { value: string }): Promise<void>;
  load(): Promise<{ value?: string }>;
  clear(): Promise<void>;
}

const SecureApiKey = registerPlugin<SecureApiKeyPlugin>("SecureApiKey");

export function createNativeApiKeyStore(
  plugin: SecureApiKeyPlugin = SecureApiKey,
): AiApiKeyStore {
  return {
    security: "secure",
    async getApiKey() {
      try {
        const result = await plugin.load();
        return result.value?.trim() || null;
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法从 Android 系统密钥库读取 API Key。",
        );
      }
    },
    async setApiKey(value: string) {
      const apiKey = normalizeAiApiKey(value);
      try {
        await plugin.save({ value: apiKey });
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法将 API Key 保存到 Android 系统密钥库。",
        );
      }
    },
    async removeApiKey() {
      try {
        await plugin.clear();
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法从 Android 系统密钥库清除 API Key。",
        );
      }
    },
  };
}

export function createPlatformAiApiKeyStore(): AiApiKeyStore {
  if (typeof globalThis.window === "undefined") {
    return createMemoryApiKeyStore();
  }
  return Capacitor.isNativePlatform()
    ? createNativeApiKeyStore()
    : createWebPreviewApiKeyStore();
}
