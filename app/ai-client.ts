import {
  isOfficialDeepSeekApiUrl,
  normalizeAiApiKey,
  validateAiSettings,
  type AiConfiguration,
} from "./ai-config";
import { buildAiProviderResourceUrl } from "./ai-providers";
import {
  AiClientError,
  assertAiHttpResponseWithinLimit,
  cancelledAiRequestError,
  createDefaultAiHttpTransport,
  throwForAiHttpStatus,
  throwIfAiRequestCancelled,
  type AiHttpResponse,
  type AiHttpTransport,
} from "./ai-transport";

export {
  MAX_AI_HTTP_REQUEST_CHARS,
  MAX_AI_HTTP_RESPONSE_CHARS,
  AiClientError,
  assertAiHttpResponseWithinLimit,
  cancelledAiRequestError,
  cancelledError,
  createCapacitorAiHttpTransport,
  createDefaultAiHttpTransport,
  createWebAiHttpTransport,
  throwForAiHttpStatus,
  throwIfAiRequestCancelled,
  throwIfCancelled,
} from "./ai-transport";
export type {
  AiClientErrorCode,
  AiHttpGetRequest,
  AiHttpRequest,
  AiHttpResponse,
  AiHttpTransport,
} from "./ai-transport";

export const MAX_AI_REQUEST_CHARS = 1_500_000;
export const MAX_AI_COMPLETION_CHARS = 240_000;
export const MAX_AI_OUTPUT_TOKENS = 32_768;

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionOptions {
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

function getHeader(
  headers: Readonly<Record<string, string>> | undefined,
  name: string,
) {
  if (!headers) {
    return null;
  }
  const target = name.toLocaleLowerCase("en-US");
  const entry = Object.entries(headers).find(
    ([key]) => key.toLocaleLowerCase("en-US") === target,
  );
  return entry?.[1] ?? null;
}

function normalizeOutputTokenLimit(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 1_024;
  }
  return Math.min(
    MAX_AI_OUTPUT_TOKENS,
    Math.max(1, Math.floor(value)),
  );
}

function validateMessages(messages: readonly AiChatMessage[]) {
  if (messages.length === 0 || messages.length > 12) {
    throw new AiClientError(
      "request-too-large",
      "AI 请求消息数量无效。",
    );
  }

  let totalCharacters = 0;
  for (const message of messages) {
    if (
      (message.role !== "system" &&
        message.role !== "user" &&
        message.role !== "assistant") ||
      typeof message.content !== "string" ||
      message.content.length === 0
    ) {
      throw new AiClientError(
        "request-too-large",
        "AI 请求消息格式无效。",
      );
    }
    totalCharacters += message.content.length;
  }

  if (totalCharacters > MAX_AI_REQUEST_CHARS) {
    throw new AiClientError(
      "request-too-large",
      "当前题库内容过大，超过单次 AI 分区上限。",
    );
  }
}

function parseResponseData(data: unknown) {
  if (typeof data === "string") {
    assertAiHttpResponseWithinLimit(data);
    try {
      return JSON.parse(data) as unknown;
    } catch {
      throw new AiClientError(
        "invalid-response",
        "AI 服务返回了无法识别的数据。",
      );
    }
  }

  if (!data || typeof data !== "object") {
    throw new AiClientError(
      "invalid-response",
      "AI 服务返回了无法识别的数据。",
    );
  }

  assertAiHttpResponseWithinLimit(data);
  return data;
}

export function extractAssistantText(data: unknown) {
  const parsed = parseResponseData(data);
  const outerRoot = parsed as {
    data?: unknown;
    choices?: unknown;
  };
  const root =
    !Array.isArray(outerRoot.choices) &&
      outerRoot.data &&
      typeof outerRoot.data === "object"
      ? outerRoot.data as {
          choices?: unknown;
          output?: unknown;
          output_text?: unknown;
          message?: { content?: unknown };
          content?: unknown;
        }
      : parsed as {
          choices?: unknown;
          output?: unknown;
          output_text?: unknown;
          message?: { content?: unknown };
          content?: unknown;
        };
  const typedRoot = root as {
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning_content?: unknown;
      };
      text?: unknown;
      finish_reason?: unknown;
    }>;
    output?: Array<{
      content?: unknown;
    }>;
    output_text?: unknown;
    message?: {
      content?: unknown;
    };
    content?: unknown;
  };

  const textFromValue = (value: unknown): string | null => {
    if (typeof value === "string") {
      return value.trim() || null;
    }
    if (Array.isArray(value)) {
      const parts = value
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (!part || typeof part !== "object") {
            return "";
          }
          const candidate = part as {
            type?: unknown;
            text?: unknown;
            content?: unknown;
          };
          if (
            typeof candidate.type === "string" &&
            candidate.type !== "text" &&
            candidate.type !== "output_text"
          ) {
            return "";
          }
          if (typeof candidate.text === "string") {
            return candidate.text;
          }
          if (
            candidate.text &&
            typeof candidate.text === "object" &&
            typeof (candidate.text as { value?: unknown }).value ===
              "string"
          ) {
            return (candidate.text as { value: string }).value;
          }
          return typeof candidate.content === "string"
            ? candidate.content
            : "";
        })
        .join("")
        .trim();
      return parts || null;
    }
    if (value && typeof value === "object") {
      const candidate = value as {
        text?: unknown;
        value?: unknown;
      };
      if (typeof candidate.text === "string") {
        return candidate.text.trim() || null;
      }
      if (typeof candidate.value === "string") {
        return candidate.value.trim() || null;
      }
    }
    return null;
  };

  const firstChoice = typedRoot.choices?.[0];
  const finishReason =
    typeof firstChoice?.finish_reason === "string"
      ? firstChoice.finish_reason
      : null;
  const candidates: unknown[] = [
    firstChoice?.message?.content,
    firstChoice?.text,
    typedRoot.output_text,
    typedRoot.message?.content,
    typedRoot.content,
  ];
  if (Array.isArray(typedRoot.output)) {
    candidates.push(
      typedRoot.output.flatMap((item) =>
        Array.isArray(item?.content) ? item.content : [item?.content]
      ),
    );
  }

  const content = candidates
    .map(textFromValue)
    .find((candidate): candidate is string => Boolean(candidate));
  if (finishReason === "insufficient_system_resource") {
    throw new AiClientError(
      "service-unavailable",
      "DeepSeek 服务当前繁忙，没有完成本次生成，请稍后重试。",
    );
  }
  if (finishReason === "length") {
    throw new AiClientError(
      "output-limit",
      "模型输出额度已用尽，没有生成完整的最终文本。请重试或改用直接返回文本的聊天模型。",
    );
  }
  if (finishReason === "content_filter") {
    throw new AiClientError(
      "invalid-response",
      "模型没有返回可用文本，请检查服务商的内容策略或更换模型。",
    );
  }
  if (!content) {
    const reasoning = textFromValue(
      firstChoice?.message?.reasoning_content,
    );
    const message = reasoning
      ? "模型只返回了思考过程，没有返回最终文本。请重试或改用直接返回文本的聊天模型。"
      : "AI 服务已响应，但返回格式中没有可用文本。";
    throw new AiClientError(
      reasoning ? "no-visible-output" : "invalid-response",
      message,
    );
  }
  if (content.length > MAX_AI_COMPLETION_CHARS) {
    throw new AiClientError(
      "response-too-large",
      "AI 返回内容过长，已拒绝使用。",
    );
  }
  return content.trim();
}

export interface OpenAiCompatibleClient {
  complete(
    messages: readonly AiChatMessage[],
    options?: AiCompletionOptions,
  ): Promise<string>;
}

export function createOpenAiCompatibleClient(
  configuration: AiConfiguration,
  transport: Pick<AiHttpTransport, "postJson"> =
    createDefaultAiHttpTransport(),
): OpenAiCompatibleClient {
  const settings = validateAiSettings(configuration);
  const apiKey = normalizeAiApiKey(configuration.apiKey);
  const endpoint = buildAiProviderResourceUrl(
    settings.apiBaseUrl,
    "chat/completions",
  );
  const disableDeepSeekThinking =
    isOfficialDeepSeekApiUrl(settings.apiBaseUrl) &&
    (settings.model === "deepseek-v4-flash" ||
      settings.model === "deepseek-v4-pro");

  return {
    async complete(messages, options = {}) {
      throwIfAiRequestCancelled(options.signal);
      validateMessages(messages);
      let response: AiHttpResponse;
      try {
        const body: Record<string, unknown> = {
          model: settings.model,
          messages: messages.map((message) => ({ ...message })),
          stream: false,
          max_tokens: normalizeOutputTokenLimit(options.maxOutputTokens),
        };
        if (disableDeepSeekThinking) {
          body.thinking = { type: "disabled" };
        }
        response = await transport.postJson({
          url: endpoint,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeoutMs: settings.timeoutMs,
          signal: options.signal,
          body,
        });
      } catch (error) {
        if (options.signal?.aborted) {
          throw cancelledAiRequestError();
        }
        if (error instanceof AiClientError) {
          throw error;
        }
        throw new AiClientError(
          "network",
          "无法连接 AI 服务，请检查地址和网络。",
        );
      }

      throwIfAiRequestCancelled(options.signal);
      throwForAiHttpStatus(response.status);
      const content = extractAssistantText(response.data);
      throwIfAiRequestCancelled(options.signal);
      return content;
    },
  };
}

export interface AiConnectionTestResult {
  ok: true;
  latencyMs: number;
}

export async function testAiConnection(
  client: OpenAiCompatibleClient,
  options: { signal?: AbortSignal } = {},
): Promise<AiConnectionTestResult> {
  const startedAt = Date.now();
  const messages: AiChatMessage[] = [
    {
      role: "system",
      content:
        "你是连接测试助手。只回复两个大写英文字母 OK，不要添加其他内容。",
    },
    { role: "user", content: "连接测试" },
  ];
  try {
    await client.complete(messages, {
      maxOutputTokens: 1_024,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (
      !(error instanceof AiClientError) ||
      (error.code !== "output-limit" &&
        error.code !== "no-visible-output")
    ) {
      throw error;
    }
    await client.complete(messages, {
      maxOutputTokens: 4_096,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  }
  return {
    ok: true,
    latencyMs: Math.max(0, Date.now() - startedAt),
  };
}

export function getAiRequestId(
  headers: Readonly<Record<string, string>> | undefined,
) {
  const value =
    getHeader(headers, "x-request-id") ??
    getHeader(headers, "request-id");
  return value && /^[A-Za-z0-9._:-]{1,128}$/u.test(value)
    ? value
    : null;
}
