import {
  CUSTOM_AI_PROVIDER_ID,
  getAiProviderDefinition,
  inferAiProviderId,
  tryGetAiProviderDefinition,
  type AiProtocol,
} from "./ai-providers";

export const AI_SETTINGS_STORAGE_KEY = "quizdeck:ai-settings:v2";
export const AI_SETTINGS_LEGACY_STORAGE_KEY = "quizdeck:ai-settings:v1";
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
  providerId: string;
  protocol: AiProtocol;
  apiBaseUrl: string;
  model: string;
  timeoutMs: number;
  detectedAt?: number;
}

export interface AiConfiguration extends AiSettings {
  apiKey: string;
}

export type AiConnectionInput = Pick<
  AiConfiguration,
  "providerId" | "protocol" | "apiBaseUrl" | "apiKey" | "timeoutMs"
>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Android should inject a KeyStore implementation backed by the platform
 * keystore. The web-preview implementation below uses sessionStorage and is
 * intentionally marked as less secure so the UI can disclose that the key is
 * available to same-origin scripts for the current browser session.
 */
export interface AiApiKeyStore {
  readonly security: "secure" | "web-preview" | "memory";
  getApiKey(expectedConnectionBinding?: string): Promise<string | null>;
  setApiKey(apiKey: string, connectionBinding?: string): Promise<void>;
  removeApiKey(): Promise<void>;
}

export type AiConfigurationErrorCode =
  | "invalid-provider"
  | "invalid-protocol"
  | "invalid-provider-url"
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

export function normalizeAiDetectedAt(value: number | undefined) {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return undefined;
  }
  return Math.floor(value);
}

type AiSettingsInput = Pick<AiSettings, "apiBaseUrl" | "model"> &
  Partial<
    Pick<
      AiSettings,
      "providerId" | "protocol" | "timeoutMs" | "detectedAt"
    >
  >;

type AiConnectionSettingsInput = Pick<AiSettings, "apiBaseUrl"> &
  Partial<
    Pick<AiSettings, "providerId" | "protocol" | "timeoutMs">
  >;

function validateAiConnectionSettings(
  value: AiConnectionSettingsInput,
): Omit<AiConnectionInput, "apiKey"> {
  const suppliedBaseUrl = normalizeAiApiBaseUrl(value.apiBaseUrl);
  const providerWasExplicit = typeof value.providerId === "string";
  const providerId = providerWasExplicit
    ? value.providerId!.trim()
    : inferAiProviderId(suppliedBaseUrl) ?? CUSTOM_AI_PROVIDER_ID;
  const provider = tryGetAiProviderDefinition(providerId);
  if (!provider) {
    throw new AiConfigurationError(
      "invalid-provider",
      "请选择受支持的 AI 服务商。",
    );
  }
  if (value.protocol && value.protocol !== provider.protocol) {
    throw new AiConfigurationError(
      "invalid-protocol",
      "AI 服务商与协议类型不匹配。",
    );
  }

  let apiBaseUrl = suppliedBaseUrl;
  if (provider.lockedBaseUrl) {
    const officialBaseUrl = normalizeAiApiBaseUrl(provider.defaultBaseUrl);
    const inferredProviderId = inferAiProviderId(suppliedBaseUrl);
    if (providerWasExplicit && suppliedBaseUrl !== officialBaseUrl) {
      throw new AiConfigurationError(
        "invalid-provider-url",
        "官方服务商必须使用预置的 API 地址。",
      );
    }
    if (!providerWasExplicit && inferredProviderId !== provider.id) {
      throw new AiConfigurationError(
        "invalid-provider-url",
        "AI 服务商与 API 地址不匹配。",
      );
    }
    apiBaseUrl = officialBaseUrl;
  }

  return {
    providerId: provider.id,
    protocol: provider.protocol,
    apiBaseUrl,
    timeoutMs: normalizeAiTimeout(value.timeoutMs),
  };
}

export function validateAiConnectionInput(
  value: Pick<AiConnectionInput, "apiBaseUrl" | "apiKey"> &
    Partial<
      Pick<AiConnectionInput, "providerId" | "protocol" | "timeoutMs">
    >,
): AiConnectionInput {
  return {
    ...validateAiConnectionSettings(value),
    apiKey: normalizeAiApiKey(value.apiKey),
  };
}

export function validateAiSettings(
  value: AiSettingsInput,
): AiSettings {
  const connection = validateAiConnectionSettings(value);

  const detectedAt = normalizeAiDetectedAt(value.detectedAt);
  const settings: AiSettings = {
    ...connection,
    model: normalizeAiProviderModel(connection.apiBaseUrl, value.model),
  };
  if (detectedAt !== undefined) {
    settings.detectedAt = detectedAt;
  }
  return settings;
}

export function createAiConnectionKeyBinding(
  value: AiConnectionSettingsInput,
) {
  const connection = validateAiConnectionSettings(value);
  return JSON.stringify([
    connection.providerId,
    connection.protocol,
    connection.apiBaseUrl,
  ]);
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

function getDefaultWebPreviewKeyStorage(): StorageLike {
  if (!globalThis.sessionStorage) {
    throw new AiConfigurationError(
      "key-storage-unavailable",
      "当前环境无法为本次会话保存 API Key。",
    );
  }
  return globalThis.sessionStorage;
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

  if (raw !== null) {
    try {
      const value = JSON.parse(raw) as Partial<AiSettings>;
      if (
        typeof value.providerId !== "string" ||
        typeof value.protocol !== "string" ||
        typeof value.apiBaseUrl !== "string" ||
        typeof value.model !== "string"
      ) {
        return null;
      }
      return validateAiSettings({
        providerId: value.providerId,
        protocol: value.protocol as AiProtocol,
        apiBaseUrl: value.apiBaseUrl,
        model: value.model,
        timeoutMs:
          typeof value.timeoutMs === "number" ? value.timeoutMs : undefined,
        detectedAt:
          typeof value.detectedAt === "number" ? value.detectedAt : undefined,
      });
    } catch {
      // A present but invalid v2 record must not silently downgrade to v1.
      return null;
    }
  }

  let legacyRaw: string | null;
  try {
    legacyRaw = storage.getItem(AI_SETTINGS_LEGACY_STORAGE_KEY);
  } catch {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "无法读取 AI 设置。",
    );
  }
  if (!legacyRaw) {
    return null;
  }

  try {
    const value = JSON.parse(legacyRaw) as Partial<AiSettings>;
    if (
      typeof value.apiBaseUrl !== "string" ||
      typeof value.model !== "string"
    ) {
      return null;
    }
    const providerId = isOfficialDeepSeekApiUrl(value.apiBaseUrl)
      ? "deepseek"
      : CUSTOM_AI_PROVIDER_ID;
    const apiBaseUrl = providerId === "deepseek"
      ? getAiProviderDefinition(providerId).defaultBaseUrl
      : buildChatCompletionsUrl(value.apiBaseUrl).replace(
          /\/chat\/completions$/u,
          "",
        );
    const settings = validateAiSettings({
      providerId,
      protocol: "openai-chat",
      apiBaseUrl,
      model: value.model,
      timeoutMs:
        typeof value.timeoutMs === "number" ? value.timeoutMs : undefined,
    });

    try {
      storage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      try {
        storage.removeItem(AI_SETTINGS_LEGACY_STORAGE_KEY);
      } catch {
        // v2 now takes precedence; a stale v1 record contains no secret.
      }
    } catch {
      // Keep v1 readable when migration cannot be persisted.
    }
    return settings;
  } catch {
    return null;
  }
}

export function writeAiSettings(
  value: AiSettingsInput,
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
  try {
    storage.removeItem(AI_SETTINGS_LEGACY_STORAGE_KEY);
  } catch {
    // v2 is authoritative once written; v1 never stores the API key.
  }
  return settings;
}

export function removeAiSettings(
  storage: StorageLike = getDefaultStorage(),
) {
  let failed = false;
  try {
    storage.removeItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    failed = true;
  }
  try {
    storage.removeItem(AI_SETTINGS_LEGACY_STORAGE_KEY);
  } catch {
    failed = true;
  }
  if (failed) {
    throw new AiConfigurationError(
      "settings-storage-unavailable",
      "无法清除 AI 设置。",
    );
  }
}

export function createWebPreviewApiKeyStore(
  storage?: StorageLike,
): AiApiKeyStore {
  const usingDefaultSessionStorage = storage === undefined;
  const keyStorage = storage ?? getDefaultWebPreviewKeyStorage();
  if (usingDefaultSessionStorage) {
    // v0.1 used localStorage for the web-preview key. Do not migrate that
    // persistent secret into the session; remove it and require re-entry.
    try {
      globalThis.localStorage?.removeItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY);
    } catch {
      // A blocked localStorage must not prevent session-only storage working.
    }
  }

  return {
    security: "web-preview",
    async getApiKey(expectedConnectionBinding) {
      try {
        const raw = keyStorage.getItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY);
        if (!raw) {
          return null;
        }
        try {
          const record = JSON.parse(raw) as {
            version?: unknown;
            apiKey?: unknown;
            connectionBinding?: unknown;
          };
          if (
            record?.version === 2 &&
            typeof record.apiKey === "string" &&
            typeof record.connectionBinding === "string"
          ) {
            if (
              expectedConnectionBinding &&
              record.connectionBinding !== expectedConnectionBinding
            ) {
              return null;
            }
            return normalizeAiApiKey(record.apiKey);
          }
        } catch {
          // A v1 record was the raw key string rather than structured JSON.
        }
        if (expectedConnectionBinding) {
          // An unbound legacy web key cannot safely be paired with shared
          // localStorage settings that another tab may have changed.
          keyStorage.removeItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY);
          return null;
        }
        return normalizeAiApiKey(raw);
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法读取 API Key。",
        );
      }
    },
    async setApiKey(value: string, connectionBinding = "") {
      const apiKey = normalizeAiApiKey(value);
      try {
        keyStorage.setItem(
          AI_WEB_PREVIEW_KEY_STORAGE_KEY,
          JSON.stringify({
            version: 2,
            apiKey,
            connectionBinding,
          }),
        );
      } catch {
        throw new AiConfigurationError(
          "key-storage-unavailable",
          "无法保存 API Key。",
        );
      }
    },
    async removeApiKey() {
      try {
        keyStorage.removeItem(AI_WEB_PREVIEW_KEY_STORAGE_KEY);
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
    storedKey = await keyStore.getApiKey(
      createAiConnectionKeyBinding(settings),
    );
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

let aiConfigurationMutationQueue: Promise<void> = Promise.resolve();

function enqueueAiConfigurationMutation<T>(operation: () => Promise<T>) {
  const result = aiConfigurationMutationQueue.then(operation, operation);
  aiConfigurationMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function saveAiConfigurationImmediately(
  value: Pick<AiConfiguration, "apiBaseUrl" | "model" | "apiKey"> &
    Partial<
      Pick<
        AiConfiguration,
        "providerId" | "protocol" | "timeoutMs" | "detectedAt"
      >
    >,
  keyStore: AiApiKeyStore,
  storage: StorageLike = getDefaultStorage(),
) {
  const settings = validateAiSettings(value);
  const apiKey = normalizeAiApiKey(value.apiKey);
  const connectionBinding = createAiConnectionKeyBinding(settings);
  const previousSettings = readAiSettings(storage);
  const previousConnectionBinding = previousSettings
    ? createAiConnectionKeyBinding(previousSettings)
    : undefined;
  let previousKey: string | null;

  try {
    previousKey = await keyStore.getApiKey(previousConnectionBinding);
    await keyStore.setApiKey(apiKey, connectionBinding);
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
        await keyStore.setApiKey(previousKey, previousConnectionBinding);
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

export function saveAiConfiguration(
  value: Pick<AiConfiguration, "apiBaseUrl" | "model" | "apiKey"> &
    Partial<
      Pick<
        AiConfiguration,
        "providerId" | "protocol" | "timeoutMs" | "detectedAt"
      >
    >,
  keyStore: AiApiKeyStore,
  storage: StorageLike = getDefaultStorage(),
) {
  return enqueueAiConfigurationMutation(() =>
    saveAiConfigurationImmediately(value, keyStore, storage)
  );
}

async function clearAiConfigurationImmediately(
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

export function clearAiConfiguration(
  keyStore: AiApiKeyStore,
  storage: StorageLike = getDefaultStorage(),
) {
  return enqueueAiConfigurationMutation(() =>
    clearAiConfigurationImmediately(keyStore, storage)
  );
}
