export const AI_SETTINGS_STORAGE_KEY = "quizdeck:ai-settings:v1";
export const AI_WEB_PREVIEW_KEY_STORAGE_KEY =
  "quizdeck:ai-api-key:web-preview:v1";

export const DEEPSEEK_API_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_PRO_MODEL = "deepseek-v4-pro";
export const DEEPSEEK_MODEL_OPTIONS = [
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_PRO_MODEL,
] as const;

export const DEFAULT_AI_TIMEOUT_MS = 60_000;
export const MIN_AI_TIMEOUT_MS = 5_000;
export const MAX_AI_TIMEOUT_MS = 120_000;

const MAX_API_URL_LENGTH = 2_048;
const MAX_MODEL_LENGTH = 128;
const MAX_API_KEY_LENGTH = 4_096;

export interface AiSettings {
  apiBaseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface AiConfiguration extends AiSettings {
  apiKey: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Android should inject a KeyStore implementation backed by the platform
 * keystore. The web-preview implementation below is intentionally marked as
 * insecure so the UI can disclose that limitation.
 */
export interface AiApiKeyStore {
  readonly security: "secure" | "web-preview" | "memory";
  getApiKey(): Promise<string | null>;
  setApiKey(apiKey: string): Promise<void>;
  removeApiKey(): Promise<void>;
}

export type AiConfigurationErrorCode =
  | "invalid-api-url"
  | "insecure-api-url"
  | "invalid-model"
  | "invalid-api-key"
  | "settings-storage-unavailable"
  | "key-storage-unavailable"
  | "missing-configuration";

export class AiConfigurationError extends Error {
  readonly code: AiConfigurationErrorCode;

  constructor(code: AiConfigurationErrorCode, message: string) {
    super(message);
    this.name = "AiConfigurationError";
    this.code = code;
  }
}

function containsControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function isLocalDevelopmentHost(hostname: string) {
  const normalized = hostname.toLocaleLowerCase("en-US");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]"
  );
}

export function normalizeAiApiBaseUrl(value: string) {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > MAX_API_URL_LENGTH ||
    containsControlCharacters(candidate)
  ) {
    throw new AiConfigurationError(
      "invalid-api-url",
      "请输入有效的 AI API 地址。",
    );
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AiConfigurationError(
      "invalid-api-url",
      "AI API 地址格式不正确。",
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && url.protocol !== "http:")
  ) {
    throw new AiConfigurationError(
      "invalid-api-url",
      "AI API 地址不能包含账号、查询参数或片段。",
    );
  }

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && isLocalDevelopmentHost(url.hostname))
  ) {
    throw new AiConfigurationError(
      "insecure-api-url",
      "AI API 必须使用 HTTPS；只有 localhost 可使用 HTTP。",
    );
  }

  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString().replace(/\/$/u, "");
}

export function buildChatCompletionsUrl(apiBaseUrl: string) {
  const normalized = normalizeAiApiBaseUrl(apiBaseUrl);
  const url = new URL(normalized);
  const path = url.pathname.replace(/\/+$/u, "");

  if (/\/chat\/completions$/u.test(path)) {
    return url.toString();
  }

  url.pathname =
    path === "/v1" || path.endsWith("/v1")
      ? `${path}/chat/completions`
      : `${path || ""}/v1/chat/completions`;
  return url.toString();
}

export function normalizeAiModel(value: string) {
  const model = value.trim();
  if (
    !model ||
    model.length > MAX_MODEL_LENGTH ||
    containsControlCharacters(model) ||
    /\s/u.test(model)
  ) {
    throw new AiConfigurationError(
      "invalid-model",
      "请输入有效的模型名称（不能包含空格）。",
    );
  }
  return model;
}

export function isOfficialDeepSeekApiUrl(value: string) {
  try {
    const url = new URL(normalizeAiApiBaseUrl(value));
    return (
      url.protocol === "https:" &&
      url.hostname.toLocaleLowerCase("en-US") === "api.deepseek.com" &&
      !url.port
    );
  } catch {
    return false;
  }
}

export function normalizeAiProviderModel(
  apiBaseUrl: string,
  value: string,
) {
  const model = normalizeAiModel(value);
  if (
    isOfficialDeepSeekApiUrl(apiBaseUrl) &&
    (model === "deepseek-chat" || model === "deepseek-reasoner")
  ) {
    return DEEPSEEK_DEFAULT_MODEL;
  }
  return model;
}

export function normalizeAiApiKey(value: string) {
  const apiKey = value.trim();
  if (
    !apiKey ||
    apiKey.length > MAX_API_KEY_LENGTH ||
    containsControlCharacters(apiKey)
  ) {
    throw new AiConfigurationError(
      "invalid-api-key",
      "请输入有效的 API Key。",
    );
  }
  return apiKey;
}

export function normalizeAiTimeout(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_AI_TIMEOUT_MS;
  }
  if (!Number.isFinite(value)) {
    return DEFAULT_AI_TIMEOUT_MS;
  }
  return Math.min(
    MAX_AI_TIMEOUT_MS,
    Math.max(MIN_AI_TIMEOUT_MS, Math.floor(value)),
  );
}

export function validateAiSettings(
  value: Pick<AiSettings, "apiBaseUrl" | "model"> &
    Partial<Pick<AiSettings, "timeoutMs">>,
): AiSettings {
  const apiBaseUrl = normalizeAiApiBaseUrl(value.apiBaseUrl);
  return {
    apiBaseUrl,
    model: normalizeAiProviderModel(apiBaseUrl, value.model),
    timeoutMs: normalizeAiTimeout(value.timeoutMs),
  };
}

function getDefaultStorage(): StorageLike {
  if (!globalThis.localStorage) {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "当前环境无法保存 AI 设置。",
    );
  }
  return globalThis.localStorage;
}

export function readAiSettings(
  storage: StorageLike = getDefaultStorage(),
): AiSettings | null {
  let raw: string | null;
  try {
    raw = storage.getItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "无法读取 AI 设置。",
    );
  }

  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Partial<AiSettings>;
    if (
      typeof value.apiBaseUrl !== "string" ||
      typeof value.model !== "string"
    ) {
      return null;
    }
    return validateAiSettings({
      apiBaseUrl: value.apiBaseUrl,
      model: value.model,
      timeoutMs:
        typeof value.timeoutMs === "number" ? value.timeoutMs : undefined,
    });
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      return null;
    }
    return null;
  }
}

export function writeAiSettings(
  value: Pick<AiSettings, "apiBaseUrl" | "model"> &
    Partial<Pick<AiSettings, "timeoutMs">>,
  storage: StorageLike = getDefaultStorage(),
) {
  const settings = validateAiSettings(value);
  try {
    storage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "无法保存 AI 设置。",
    );
  }
  return settings;
}

export function removeAiSettings(
  storage: StorageLike = getDefaultStorage(),
) {
  try {
    storage.removeItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "无法清除 AI 设置。",
    );
  }
}

export function createWebPreviewApiKeyStore(
  storage: StorageLike = getDefaultStorage(),
): AiApiKeyStore {
  return {
    security: "web-preview",
    async getApiKey() {
      try {
        return storage.getItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY);
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法读取 API Key。",
        );
      }
    },
    async setApiKey(value: string) {
      const apiKey = normalizeAiApiKey(value);
      try {
        storage.setItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY, apiKey);
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法保存 API Key。",
        );
      }
    },
    async removeApiKey() {
      try {
        storage.removeItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY);
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法清除 API Key。",
        );
      }
    },
  };
}

export function createMemoryApiKeyStore(
  initialValue: string | null = null,
): AiApiKeyStore {
  let apiKey = initialValue ? normalizeAiApiKey(initialValue) : null;
  return {
    security: "memory",
    async getApiKey() {
      return apiKey;
    },
    async setApiKey(value: string) {
      apiKey = normalizeAiApiKey(value);
    },
    async removeApiKey() {
      apiKey = null;
    },
  };
}

export async function loadAiConfiguration(
  keyStore: AiApiKeyStore,
  storage: StorageLike = getDefaultStorage(),
): Promise<AiConfiguration | null> {
  const settings = readAiSettings(storage);
  if (!settings) {
    return null;
  }

  let storedKey: string | null;
  try {
    storedKey = await keyStore.getApiKey();
  } catch {
    throw new AiConfigurationError(
      "key-storage-unavailable",
      "无法读取 API Key。",
    );
  }

  if (!storedKey) {
    return null;
  }

  return {
    ...settings,
    apiKey: normalizeAiApiKey(storedKey),
  };
}

export async function saveAiConfiguration(
  value: Pick<AiConfiguration, "apiBaseUrl" | "model" | "apiKey"> &
    Partial<Pick<AiConfiguration, "timeoutMs">>,
  keyStore: AiApiKeyStore,
  storage: StorageLike = getDefaultStorage(),
) {
  const settings = validateAiSettings(value);
  const apiKey = normalizeAiApiKey(value.apiKey);
  let previousKey: string | null;

  try {
    previousKey = await keyStore.getApiKey();
    await keyStore.setApiKey(apiKey);
  } catch {
    throw new AiConfigurationError(
      "key-storage-unavailable",
      "无法保存 API Key。",
    );
  }

  try {
    writeAiSettings(settings, storage);
  } catch (error) {
    // Restore the previous secret if ordinary settings could not be committed.
    try {
      if (previousKey) {
        await keyStore.setApiKey(previousKey);
      } else {
        await keyStore.removeApiKey();
      }
    } catch {
      // Do not expose secure-store implementation errors or any key material.
    }
    throw error;
  }

  return settings;
}

export async function clearAiConfiguration(
  keyStore: AiApiKeyStore,
  storage: StorageLike = getDefaultStorage(),
) {
  try {
    await keyStore.removeApiKey();
  } catch {
    throw new AiConfigurationError(
      "key-storage-unavailable",
      "无法清除 API Key，原配置未作更改。",
    );
  }
  try {
    removeAiSettings(storage);
  } catch {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "API Key 已清除，但无法清除其余 AI 设置。",
    );
  }
}
