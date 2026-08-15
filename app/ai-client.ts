import { Capacitor, CapacitorHttp } from "@capacitor/core";

import {
  buildChatCompletionsUrl,
  isOfficialDeepSeekApiUrl,
  normalizeAiApiKey,
  validateAiSettings,
  type AiConfiguration,
} from "./ai-config";

export const MAX_AI_REQUEST_CHARS = 1_500_000;
export const MAX_AI_HTTP_RESPONSE_CHARS = 320_000;
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

export interface AiHttpRequest {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: Readonly<Record<string, unknown>>;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface AiHttpResponse {
  status: number;
  data: unknown;
  headers?: Readonly<Record<string, string>>;
}

export interface AiHttpTransport {
  postJson(request: AiHttpRequest): Promise<AiHttpResponse>;
}

export type AiClientErrorCode =
  | "request-too-large"
  | "response-too-large"
  | "cancelled"
  | "timeout"
  | "network"
  | "authentication"
  | "not-found"
  | "rate-limited"
  | "provider"
  | "output-limit"
  | "no-visible-output"
  | "invalid-response";

export class AiClientError extends Error {
  readonly code: AiClientErrorCode;
  readonly status?: number;

  constructor(code: AiClientErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AiClientError";
    this.code = code;
    this.status = status;
  }
}

function cancelledError() {
  return new AiClientError(
    "cancelled",
    "已取消 AI 请求。",
  );
}

function throwIfCancelled(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw cancelledError();
  }
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

async function readFetchResponseWithLimit(
  response: Response,
  maximumChars: number,
) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumChars * 4) {
    throw new AiClientError(
      "response-too-large",
      "AI 返回的数据过大，已停止读取。",
    );
  }

  if (!response.body) {
    const text = await response.text();
    if (text.length > maximumChars) {
      throw new AiClientError(
        "response-too-large",
        "AI 返回的数据过大，已停止读取。",
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        text += decoder.decode();
        break;
      }
      text += decoder.decode(result.value, { stream: true });
      if (text.length > maximumChars) {
        await reader.cancel();
        throw new AiClientError(
          "response-too-large",
          "AI 返回的数据过大，已停止读取。",
        );
      }
    }
  } finally {
    reader.releaseLock();
  }
  return text;
}

function browserFetchTransport(): AiHttpTransport {
  return {
    async postJson(request) {
      throwIfCancelled(request.signal);
      if (!globalThis.fetch) {
        throw new AiClientError(
          "network",
          "当前环境不支持访问 AI 服务。",
        );
      }

      const controller = new AbortController();
      let timedOut = false;
      const cancelRequest = () => controller.abort();
      request.signal?.addEventListener("abort", cancelRequest, {
        once: true,
      });
      const timeout = globalThis.setTimeout(
        () => {
          timedOut = true;
          controller.abort();
        },
        request.timeoutMs,
      );
      try {
        const response = await globalThis.fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
          credentials: "omit",
        });
        throwIfCancelled(request.signal);

        if (!response.ok) {
          return {
            status: response.status,
            data: null,
            headers: Object.fromEntries(response.headers.entries()),
          };
        }

        const text = await readFetchResponseWithLimit(
          response,
          MAX_AI_HTTP_RESPONSE_CHARS,
        );
        throwIfCancelled(request.signal);
        return {
          status: response.status,
          data: text,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (error) {
        if (request.signal?.aborted) {
          throw cancelledError();
        }
        if (error instanceof AiClientError) {
          throw error;
        }
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          throw new AiClientError(
            timedOut ? "timeout" : "network",
            timedOut
              ? "AI 请求超时，请稍后重试。"
              : "AI 请求被意外中止，请重试。",
          );
        }
        throw new AiClientError(
          "network",
          "无法连接 AI 服务，请检查地址和网络。",
        );
      } finally {
        globalThis.clearTimeout(timeout);
        request.signal?.removeEventListener("abort", cancelRequest);
      }
    },
  };
}

function nativeCapacitorTransport(): AiHttpTransport {
  return {
    async postJson(request) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let cancelRequest: (() => void) | undefined;
      throwIfCancelled(request.signal);
      try {
        const cancellation = new Promise<never>((_, reject) => {
          if (!request.signal) {
            return;
          }
          cancelRequest = () => reject(cancelledError());
          request.signal.addEventListener("abort", cancelRequest, {
            once: true,
          });
        });
        const response = await Promise.race([
          CapacitorHttp.request({
            url: request.url,
            method: "POST",
            headers: { ...request.headers },
            data: { ...request.body },
            connectTimeout: request.timeoutMs,
            readTimeout: request.timeoutMs,
            disableRedirects: true,
            responseType: "json",
          }),
          new Promise<never>((_, reject) => {
            timeout = globalThis.setTimeout(
              () =>
                reject(
                  new AiClientError(
                    "timeout",
                    "AI 请求超时，请稍后重试。",
                  ),
                ),
              request.timeoutMs,
            );
          }),
          cancellation,
        ]);
        throwIfCancelled(request.signal);
        return {
          status: response.status,
          data: response.data,
          headers: response.headers,
        };
      } catch (error) {
        if (request.signal?.aborted) {
          throw cancelledError();
        }
        if (error instanceof AiClientError) {
          throw error;
        }
        throw new AiClientError(
          "network",
          "无法连接 AI 服务，请检查地址和网络。",
        );
      } finally {
        if (timeout !== undefined) {
          globalThis.clearTimeout(timeout);
        }
        if (cancelRequest) {
          request.signal?.removeEventListener(
            "abort",
            cancelRequest,
          );
        }
      }
    },
  };
}

export function createDefaultAiHttpTransport(): AiHttpTransport {
  return Capacitor.isNativePlatform()
    ? nativeCapacitorTransport()
    : browserFetchTransport();
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

function throwForHttpStatus(status: number) {
  if (status === 401 || status === 403) {
    throw new AiClientError(
      "authentication",
      `API Key 无效或没有访问该模型的权限（HTTP ${status}）。`,
      status,
    );
  }
  if (status === 402) {
    throw new AiClientError(
      "provider",
      "AI 账户余额不足，请充值后重试（HTTP 402）。",
      status,
    );
  }
  if (status === 404) {
    throw new AiClientError(
      "not-found",
      "AI 接口或模型不存在，请检查 API 地址和模型名称。",
      status,
    );
  }
  if (status === 408 || status === 504) {
    throw new AiClientError(
      "timeout",
      "AI 服务响应超时，请稍后重试。",
      status,
    );
  }
  if (status === 429) {
    throw new AiClientError(
      "rate-limited",
      "AI 服务请求过于频繁，请稍后重试（HTTP 429）。",
      status,
    );
  }
  if (status === 422) {
    throw new AiClientError(
      "provider",
      "AI 服务无法处理当前参数，请检查模型名称和接口配置（HTTP 422）。",
      status,
    );
  }
  if (status < 200 || status >= 300) {
    throw new AiClientError(
      "provider",
      status >= 500
        ? "AI 服务暂时不可用，请稍后重试。"
        : "AI 服务拒绝了请求，请检查配置。",
      status,
    );
  }
}

function parseResponseData(data: unknown) {
  if (typeof data === "string") {
    if (data.length > MAX_AI_HTTP_RESPONSE_CHARS) {
      throw new AiClientError(
        "response-too-large",
        "AI 返回的数据过大，已停止读取。",
      );
    }
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

  try {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_AI_HTTP_RESPONSE_CHARS) {
      throw new AiClientError(
        "response-too-large",
        "AI 返回的数据过大，已停止读取。",
      );
    }
  } catch (error) {
    if (error instanceof AiClientError) {
      throw error;
    }
    throw new AiClientError(
      "invalid-response",
      "AI 服务返回了无法识别的数据。",
    );
  }
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
      "provider",
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
  transport: AiHttpTransport = createDefaultAiHttpTransport(),
): OpenAiCompatibleClient {
  const settings = validateAiSettings(configuration);
  const apiKey = normalizeAiApiKey(configuration.apiKey);
  const endpoint = buildChatCompletionsUrl(settings.apiBaseUrl);
  const disableDeepSeekThinking =
    isOfficialDeepSeekApiUrl(settings.apiBaseUrl) &&
    (settings.model === "deepseek-v4-flash" ||
      settings.model === "deepseek-v4-pro");

  return {
    async complete(messages, options = {}) {
      throwIfCancelled(options.signal);
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
          throw cancelledError();
        }
        if (error instanceof AiClientError) {
          throw error;
        }
        throw new AiClientError(
          "network",
          "无法连接 AI 服务，请检查地址和网络。",
        );
      }

      throwIfCancelled(options.signal);
      throwForHttpStatus(response.status);
      const content = extractAssistantText(response.data);
      throwIfCancelled(options.signal);
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
    await client.complete(messages, { maxOutputTokens: 1_024 });
  } catch (error) {
    if (
      !(error instanceof AiClientError) ||
      (error.code !== "output-limit" &&
        error.code !== "no-visible-output")
    ) {
      throw error;
    }
    await client.complete(messages, { maxOutputTokens: 4_096 });
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
