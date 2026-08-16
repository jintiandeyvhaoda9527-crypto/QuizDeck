export const DEFAULT_AI_PROVIDER_ID = "deepseek" as const;
export const CUSTOM_AI_PROVIDER_ID = "custom-openai" as const;

export const AI_PROVIDER_IDS = [
  "openai",
  DEFAULT_AI_PROVIDER_ID,
  "gemini",
  "qwen",
  "doubao",
  "glm",
  "kimi",
  "minimax-cn",
  "minimax-global",
  "xai",
  CUSTOM_AI_PROVIDER_ID,
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];
export type OfficialAiProviderId = Exclude<
  AiProviderId,
  typeof CUSTOM_AI_PROVIDER_ID
>;
export type AiProtocol = "openai-chat";
export type AiModelDiscoveryMode = "openai-models";
export type AiProviderResource = "models" | "chat/completions";

export interface AiProviderDefinition {
  readonly id: AiProviderId;
  readonly name: string;
  readonly nameEn: string;
  readonly protocol: AiProtocol;
  readonly homepageUrl: string;
  readonly docsUrl: string;
  readonly apiKeyUrl: string;
  readonly defaultBaseUrl: string;
  readonly discoveryMode: AiModelDiscoveryMode;
  readonly fallbackModels: readonly string[];
  readonly lockedBaseUrl: boolean;
}

function defineAiProvider(
  definition: AiProviderDefinition,
): Readonly<AiProviderDefinition> {
  return Object.freeze({
    ...definition,
    fallbackModels: Object.freeze([...definition.fallbackModels]),
  });
}

export const AI_PROVIDER_DEFINITIONS = Object.freeze([
  defineAiProvider({
    id: "openai",
    name: "OpenAI",
    nameEn: "OpenAI",
    protocol: "openai-chat",
    homepageUrl: "https://openai.com/",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultBaseUrl: "https://api.openai.com/v1",
    discoveryMode: "openai-models",
    fallbackModels: ["gpt-4.1-mini", "gpt-4.1"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: DEFAULT_AI_PROVIDER_ID,
    name: "DeepSeek",
    nameEn: "DeepSeek",
    protocol: "openai-chat",
    homepageUrl: "https://www.deepseek.com/",
    docsUrl: "https://api-docs.deepseek.com/",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    defaultBaseUrl: "https://api.deepseek.com",
    discoveryMode: "openai-models",
    fallbackModels: ["deepseek-v4-flash", "deepseek-v4-pro"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "gemini",
    name: "Google Gemini",
    nameEn: "Google Gemini",
    protocol: "openai-chat",
    homepageUrl: "https://ai.google.dev/",
    docsUrl: "https://ai.google.dev/gemini-api/docs/openai",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    defaultBaseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai",
    discoveryMode: "openai-models",
    fallbackModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "qwen",
    name: "阿里云百炼 / 千问",
    nameEn: "Alibaba Cloud Model Studio / Qwen",
    protocol: "openai-chat",
    homepageUrl: "https://www.aliyun.com/product/bailian",
    docsUrl:
      "https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions",
    apiKeyUrl: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
    defaultBaseUrl:
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    discoveryMode: "openai-models",
    fallbackModels: ["qwen-plus", "qwen-turbo"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "doubao",
    name: "火山方舟 / 豆包",
    nameEn: "Volcano Engine Ark / Doubao",
    protocol: "openai-chat",
    homepageUrl: "https://www.volcengine.com/product/ark",
    docsUrl: "https://www.volcengine.com/docs/82379/1795150",
    apiKeyUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    discoveryMode: "openai-models",
    fallbackModels: ["doubao-seed-1-6-250615"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "glm",
    name: "智谱 GLM",
    nameEn: "Zhipu GLM",
    protocol: "openai-chat",
    homepageUrl: "https://www.bigmodel.cn/",
    docsUrl:
      "https://docs.bigmodel.cn/cn/guide/develop/openai/introduction",
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    discoveryMode: "openai-models",
    fallbackModels: ["glm-4.5-flash", "glm-4.5"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "kimi",
    name: "Moonshot / Kimi",
    nameEn: "Moonshot / Kimi",
    protocol: "openai-chat",
    homepageUrl: "https://platform.moonshot.cn/",
    docsUrl: "https://platform.moonshot.cn/docs/api/chat",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    discoveryMode: "openai-models",
    fallbackModels: ["moonshot-v1-8k", "moonshot-v1-32k"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "minimax-cn",
    name: "MiniMax（中国大陆）",
    nameEn: "MiniMax (Mainland China)",
    protocol: "openai-chat",
    homepageUrl: "https://www.minimaxi.com/",
    docsUrl:
      "https://platform.minimaxi.com/docs/api-reference/text-openai-api",
    apiKeyUrl:
      "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    defaultBaseUrl: "https://api.minimaxi.com/v1",
    discoveryMode: "openai-models",
    fallbackModels: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "minimax-global",
    name: "MiniMax（国际）",
    nameEn: "MiniMax (Global)",
    protocol: "openai-chat",
    homepageUrl: "https://www.minimax.io/",
    docsUrl:
      "https://platform.minimax.io/docs/api-reference/text-openai-api",
    apiKeyUrl:
      "https://platform.minimax.io/user-center/basic-information/interface-key",
    defaultBaseUrl: "https://api.minimax.io/v1",
    discoveryMode: "openai-models",
    fallbackModels: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: "xai",
    name: "xAI / Grok",
    nameEn: "xAI / Grok",
    protocol: "openai-chat",
    homepageUrl: "https://x.ai/",
    docsUrl: "https://docs.x.ai/docs/api-reference",
    apiKeyUrl: "https://console.x.ai/",
    defaultBaseUrl: "https://api.x.ai/v1",
    discoveryMode: "openai-models",
    fallbackModels: ["grok-3-mini", "grok-3"],
    lockedBaseUrl: true,
  }),
  defineAiProvider({
    id: CUSTOM_AI_PROVIDER_ID,
    name: "自定义 OpenAI 兼容服务",
    nameEn: "Custom OpenAI-compatible service",
    protocol: "openai-chat",
    homepageUrl: "",
    docsUrl: "",
    apiKeyUrl: "",
    defaultBaseUrl: "",
    discoveryMode: "openai-models",
    fallbackModels: [],
    lockedBaseUrl: false,
  }),
]);

export const AI_PROVIDERS = AI_PROVIDER_DEFINITIONS;

const AI_PROVIDER_BY_ID = new Map(
  AI_PROVIDER_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
);

const OFFICIAL_PROVIDER_ID_BY_HOSTNAME = new Map(
  AI_PROVIDER_DEFINITIONS.filter(
    (definition) => definition.lockedBaseUrl,
  ).map((definition) => [
    new URL(definition.defaultBaseUrl).hostname.toLocaleLowerCase("en-US"),
    definition.id as OfficialAiProviderId,
  ]),
);

export function tryGetAiProviderDefinition(
  providerId: string | null | undefined,
): Readonly<AiProviderDefinition> | undefined {
  if (!providerId) {
    return undefined;
  }
  return AI_PROVIDER_BY_ID.get(providerId as AiProviderId);
}

export function getAiProviderDefinition(
  providerId: string,
): Readonly<AiProviderDefinition> {
  const definition = tryGetAiProviderDefinition(providerId);
  if (!definition) {
    throw new RangeError(`Unsupported AI provider: ${providerId}`);
  }
  return definition;
}

export function isCustomAiProviderId(
  providerId: string,
): providerId is typeof CUSTOM_AI_PROVIDER_ID {
  return providerId === CUSTOM_AI_PROVIDER_ID;
}

export function isOfficialAiProviderId(
  providerId: string,
): providerId is OfficialAiProviderId {
  const definition = tryGetAiProviderDefinition(providerId);
  return definition?.lockedBaseUrl === true;
}

type AiProviderReference =
  | string
  | Pick<Readonly<AiProviderDefinition>, "id">;

export function isCustomAiProvider(provider: AiProviderReference) {
  return isCustomAiProviderId(
    typeof provider === "string" ? provider : provider.id,
  );
}

export function isOfficialAiProvider(provider: AiProviderReference) {
  return isOfficialAiProviderId(
    typeof provider === "string" ? provider : provider.id,
  );
}

function tryInferOfficialAiProviderId(
  apiBaseUrl: string,
): OfficialAiProviderId | undefined {
  try {
    const url = new URL(apiBaseUrl.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return undefined;
    }
    return OFFICIAL_PROVIDER_ID_BY_HOSTNAME.get(
      url.hostname.toLocaleLowerCase("en-US"),
    );
  } catch {
    return undefined;
  }
}

export function inferAiProviderIdFromApiBaseUrl(
  apiBaseUrl: string,
): AiProviderId {
  return tryInferOfficialAiProviderId(apiBaseUrl) ?? CUSTOM_AI_PROVIDER_ID;
}

export const inferAiProviderId = inferAiProviderIdFromApiBaseUrl;

export function isOfficialAiProviderApiBaseUrl(apiBaseUrl: string) {
  return tryInferOfficialAiProviderId(apiBaseUrl) !== undefined;
}

export function isCustomAiProviderApiBaseUrl(apiBaseUrl: string) {
  return !isOfficialAiProviderApiBaseUrl(apiBaseUrl);
}

export function buildAiProviderResourceUrl(
  apiBaseUrl: string,
  resource: AiProviderResource,
) {
  const candidate = apiBaseUrl.trim();
  if (!candidate) {
    throw new TypeError("AI API base URL is required.");
  }

  const url = new URL(candidate);
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("AI API base URL is invalid.");
  }

  const path = url.pathname.replace(/\/+$/u, "");
  if (/\/chat\/completions$/u.test(path)) {
    url.pathname =
      resource === "chat/completions"
        ? path
        : path.replace(/\/chat\/completions$/u, "/models");
  } else if (/\/models$/u.test(path)) {
    url.pathname =
      resource === "models"
        ? path
        : path.replace(/\/models$/u, "/chat/completions");
  } else {
    url.pathname = `${path}/${resource}`;
  }

  return url.toString();
}
