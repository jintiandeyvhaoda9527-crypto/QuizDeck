import {
  normalizeAiModel,
  validateAiConnectionInput,
  type AiConnectionInput,
} from "./ai-config";
import {
  buildAiProviderResourceUrl,
  getAiProviderDefinition,
} from "./ai-providers";
import {
  AiClientError,
  assertAiHttpResponseWithinLimit,
  createDefaultAiHttpTransport,
  throwForAiHttpStatus,
  type AiHttpTransport,
} from "./ai-transport";

export const MAX_DISCOVERED_AI_MODELS = 500;

export type AiModelReleaseStage = "stable" | "preview";

export interface AiModel {
  id: string;
  name: string;
  ownedBy?: string;
  isReasoning?: boolean;
  contextWindow?: number;
  releaseStage?: AiModelReleaseStage;
  recommended: boolean;
}

export type AiModelDiscoveryWarning =
  | "unsupported"
  | "browser-direct-unavailable"
  | "invalid-response"
  | "empty";

export interface AiModelDiscoveryResult {
  models: readonly AiModel[];
  source: "upstream" | "fallback";
  detectedAt?: number;
  warning?: AiModelDiscoveryWarning;
  truncated?: boolean;
}

interface UpstreamModelLike {
  id?: unknown;
  model?: unknown;
  name?: unknown;
  displayName?: unknown;
  owned_by?: unknown;
  ownedBy?: unknown;
  context_window?: unknown;
  context_length?: unknown;
  inputTokenLimit?: unknown;
}

function parseResponseData(data: unknown) {
  assertAiHttpResponseWithinLimit(data);
  if (typeof data !== "string") {
    return data;
  }
  try {
    return JSON.parse(data) as unknown;
  } catch {
    throw new AiClientError(
      "invalid-response",
      "模型列表返回了无法识别的数据。",
    );
  }
}

function readModelArray(data: unknown): readonly unknown[] {
  const parsed = parseResponseData(data);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (!parsed || typeof parsed !== "object") {
    throw new AiClientError(
      "invalid-response",
      "模型列表返回格式不正确。",
    );
  }
  const root = parsed as { data?: unknown; models?: unknown };
  if (Array.isArray(root.data)) {
    return root.data;
  }
  if (Array.isArray(root.models)) {
    return root.models;
  }
  if (root.data && typeof root.data === "object") {
    const nested = root.data as { data?: unknown; models?: unknown };
    if (Array.isArray(nested.data)) {
      return nested.data;
    }
    if (Array.isArray(nested.models)) {
      return nested.models;
    }
  }
  throw new AiClientError(
    "invalid-response",
    "模型列表返回格式不正确。",
  );
}

function safeOptionalText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim();
  return text &&
    text.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/u.test(text)
    ? text
    : undefined;
}

function readContextWindow(model: UpstreamModelLike) {
  const candidate = [
    model.context_window,
    model.context_length,
    model.inputTokenLimit,
  ].find((value) => typeof value === "number" && Number.isFinite(value));
  if (typeof candidate !== "number" || candidate <= 0) {
    return undefined;
  }
  return Math.min(10_000_000, Math.floor(candidate));
}

function isNonChatModel(modelId: string) {
  const normalized = modelId.toLocaleLowerCase("en-US");
  return (
    /(?:^|[-_.\/])(embedding|moderation|rerank|image|images|tts|speech|audio|realtime|transcribe|transcription|whisper)(?:$|[-_.\/])/u.test(
      normalized,
    ) ||
    /(?:^|[-_.\/])(dall-e|sora|veo|imagen)(?:$|[-_.\/])/u.test(
      normalized,
    ) ||
    /^(?:babbage|davinci)(?:-|$)/u.test(normalized)
  );
}

function inferReasoning(modelId: string) {
  return /(?:reason|thinking|reasoner|(?:^|[-_.])r1(?:$|[-_.])|(?:^|[-_.])qwq(?:$|[-_.])|^o[1-9](?:-|$))/iu.test(
    modelId,
  ) || undefined;
}

function inferReleaseStage(modelId: string): AiModelReleaseStage | undefined {
  if (/(?:preview|beta|experimental|(?:^|[-_.])exp(?:$|[-_.]))/iu.test(modelId)) {
    return "preview";
  }
  return undefined;
}

function modelFromUpstream(
  value: unknown,
  fallbackModels: readonly string[],
): AiModel | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as UpstreamModelLike;
  const rawId = candidate.id ?? candidate.model ?? candidate.name;
  const suppliedId = safeOptionalText(rawId, 128);
  if (!suppliedId) {
    return null;
  }
  const id = suppliedId.startsWith("models/")
    ? suppliedId.slice("models/".length)
    : suppliedId;
  try {
    normalizeAiModel(id);
  } catch {
    return null;
  }
  if (isNonChatModel(id)) {
    return null;
  }
  const recommended = fallbackModels.includes(id);
  const releaseStage = inferReleaseStage(id) ??
    (recommended ? "stable" : undefined);
  const model: AiModel = {
    id,
    name:
      safeOptionalText(candidate.displayName, 256) ??
      safeOptionalText(candidate.name, 256) ??
      id,
    recommended,
  };
  const ownedBy = safeOptionalText(
    candidate.owned_by ?? candidate.ownedBy,
    128,
  );
  const isReasoning = inferReasoning(id);
  const contextWindow = readContextWindow(candidate);
  if (ownedBy) {
    model.ownedBy = ownedBy;
  }
  if (isReasoning) {
    model.isReasoning = true;
  }
  if (contextWindow) {
    model.contextWindow = contextWindow;
  }
  if (releaseStage) {
    model.releaseStage = releaseStage;
  }
  return model;
}

function compareModels(
  left: AiModel,
  right: AiModel,
  fallbackModels: readonly string[],
) {
  const leftRecommendation = fallbackModels.indexOf(left.id);
  const rightRecommendation = fallbackModels.indexOf(right.id);
  const leftRank = leftRecommendation < 0
    ? Number.POSITIVE_INFINITY
    : leftRecommendation;
  const rightRank = rightRecommendation < 0
    ? Number.POSITIVE_INFINITY
    : rightRecommendation;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const stageRank = (model: AiModel) =>
    model.releaseStage === "stable"
      ? 0
      : model.releaseStage === "preview"
        ? 2
        : 1;
  const stageDifference = stageRank(left) - stageRank(right);
  return stageDifference || left.name.localeCompare(right.name, "en", {
    numeric: true,
    sensitivity: "base",
  });
}

export function parseOpenAiModelList(
  data: unknown,
  fallbackModels: readonly string[] = [],
) {
  const rawModels = readModelArray(data);
  const unique = new Map<string, AiModel>();
  for (const value of rawModels) {
    const model = modelFromUpstream(value, fallbackModels);
    if (!model || unique.has(model.id)) {
      continue;
    }
    unique.set(model.id, model);
    if (unique.size >= MAX_DISCOVERED_AI_MODELS) {
      break;
    }
  }
  return [...unique.values()].sort((left, right) =>
    compareModels(left, right, fallbackModels)
  );
}

export function getFallbackAiModels(providerId: string) {
  const fallbackModels = getAiProviderDefinition(providerId).fallbackModels;
  return fallbackModels.map((id, index): AiModel => ({
    id,
    name: id,
    isReasoning: inferReasoning(id),
    releaseStage: inferReleaseStage(id) ?? "stable",
    recommended: index === 0,
  }));
}

function fallbackResult(
  providerId: string,
  warning: AiModelDiscoveryWarning,
): AiModelDiscoveryResult {
  return {
    models: getFallbackAiModels(providerId),
    source: "fallback",
    warning,
  };
}

export async function discoverOpenAiModels(
  connection: AiConnectionInput,
  options: {
    signal?: AbortSignal;
    transport?: Pick<AiHttpTransport, "getJson">;
  } = {},
): Promise<AiModelDiscoveryResult> {
  const validated = validateAiConnectionInput(connection);
  const provider = getAiProviderDefinition(validated.providerId);
  const transport = options.transport ?? createDefaultAiHttpTransport();
  try {
    const response = await transport.getJson({
      url: buildAiProviderResourceUrl(validated.apiBaseUrl, "models"),
      headers: {
        Authorization: `Bearer ${validated.apiKey}`,
        Accept: "application/json",
      },
      timeoutMs: validated.timeoutMs,
      signal: options.signal,
    });
    throwForAiHttpStatus(response.status);
    const rawModels = readModelArray(response.data);
    const models = parseOpenAiModelList(response.data, provider.fallbackModels);
    if (models.length === 0) {
      return fallbackResult(validated.providerId, "empty");
    }
    return {
      models,
      source: "upstream",
      detectedAt: Date.now(),
      truncated: rawModels.length > MAX_DISCOVERED_AI_MODELS,
    };
  } catch (error) {
    if (error instanceof AiClientError) {
      if (error.code === "not-found") {
        return fallbackResult(validated.providerId, "unsupported");
      }
      if (error.code === "browser-direct-unavailable") {
        return fallbackResult(
          validated.providerId,
          "browser-direct-unavailable",
        );
      }
      if (error.code === "invalid-response") {
        return fallbackResult(validated.providerId, "invalid-response");
      }
    }
    throw error;
  }
}

export function filterAiModels(
  models: readonly AiModel[],
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase("en-US");
  if (!normalized) {
    return [...models];
  }
  return models.filter((model) =>
    `${model.name}\n${model.id}\n${model.ownedBy ?? ""}`
      .toLocaleLowerCase("en-US")
      .includes(normalized)
  );
}

export function isModelMissingFromUpstream(
  modelId: string,
  result: AiModelDiscoveryResult | null,
) {
  return Boolean(
    modelId &&
      result?.source === "upstream" &&
      !result.models.some((model) => model.id === modelId),
  );
}
