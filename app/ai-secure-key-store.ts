import { Capacitor, registerPlugin } from "@capacitor/core";

import {
  AiConfigurationError,
  createMemoryApiKeyStore,
  createWebPreviewApiKeyStore,
  normalizeAiApiKey,
  type AiApiKeyStore,
} from "./ai-config";

interface SecureApiKeyPlugin {
  save(options: { value: string; connectionBinding?: string }): Promise<void>;
  load(): Promise<{ value?: string; connectionBinding?: string }>;
  clear(): Promise<void>;
}

const SecureApiKey = registerPlugin<SecureApiKeyPlugin>("SecureApiKey");

export function createNativeApiKeyStore(
  plugin: SecureApiKeyPlugin = SecureApiKey,
): AiApiKeyStore {
  let operationQueue: Promise<void> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>) => {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    security: "secure",
    getApiKey(expectedConnectionBinding) {
      return enqueue(async () => {
        try {
          const result = await plugin.load();
          const value = result.value?.trim();
          if (!value) {
            return null;
          }
          if (expectedConnectionBinding) {
            if (
              result.connectionBinding &&
              result.connectionBinding !== expectedConnectionBinding
            ) {
              return null;
            }
            if (!result.connectionBinding) {
              // Bind an existing pre-v2 Android key in place. Keep load and
              // save inside this store's queue so a concurrent clear cannot
              // be followed by a stale migration that resurrects the key.
              await plugin.save({
                value,
                connectionBinding: expectedConnectionBinding,
              });
            }
          }
          return value;
        } catch {
          throw new AiConfigurationError(
            "key-storage-unavailable",
            "无法从 Android 系统密钥库读取 API Key。",
          );
        }
      });
    },
    setApiKey(value: string, connectionBinding) {
      return enqueue(async () => {
        const apiKey = normalizeAiApiKey(value);
        try {
          await plugin.save({
            value: apiKey,
            ...(connectionBinding ? { connectionBinding } : {}),
          });
        } catch {
          throw new AiConfigurationError(
            "key-storage-unavailable",
            "无法将 API Key 保存到 Android 系统密钥库。",
          );
        }
      });
    },
    removeApiKey() {
      return enqueue(async () => {
        try {
          await plugin.clear();
        } catch {
          throw new AiConfigurationError(
            "key-storage-unavailable",
            "无法从 Android 系统密钥库清除 API Key。",
          );
        }
      });
    },
  };
}

export function createPlatformAiApiKeyStore(): AiApiKeyStore {
  // Server rendering has no browser storage, Android uses the system
  // keystore, and the web preview limits its key to sessionStorage.
  if (typeof globalThis.window === "undefined") {
    return createMemoryApiKeyStore();
  }
  return Capacitor.isNativePlatform()
    ? createNativeApiKeyStore()
    : createWebPreviewApiKeyStore();
}
