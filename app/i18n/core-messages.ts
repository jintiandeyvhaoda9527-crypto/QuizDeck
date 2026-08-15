export const coreMessages = {
  "zh-CN": {
    "ai.keyStorage.webPreview":
      "网页预览仅在当前浏览器会话中保存 API Key；关闭会话后需要重新输入。",
    "core.error.aiClient.request-too-large": "AI 请求内容过大。",
    "core.error.aiClient.response-too-large": "AI 返回内容过大，已停止处理。",
    "core.error.aiClient.cancelled": "AI 请求已取消。",
    "core.error.aiClient.timeout": "AI 请求超时，请稍后重试。",
    "core.error.aiClient.network": "无法连接 AI 服务，请检查地址和网络。",
    "core.error.aiClient.authentication":
      "API Key 无效，或无权访问所选模型。",
    "core.error.aiClient.not-found":
      "AI 接口或模型不存在，请检查配置。",
    "core.error.aiClient.rate-limited":
      "AI 服务请求过于频繁，请稍后重试。",
    "core.error.aiClient.provider": "AI 服务暂时无法完成请求。",
    "core.error.aiClient.output-limit":
      "模型未能在输出限制内返回完整结果。",
    "core.error.aiClient.no-visible-output":
      "模型没有返回可用的最终文本。",
    "core.error.aiClient.invalid-response":
      "AI 服务返回了无法识别的数据。",
    "core.error.aiConfiguration.invalid-api-url":
      "请输入有效的 AI API 地址。",
    "core.error.aiConfiguration.insecure-api-url":
      "AI API 必须使用 HTTPS；只有本机地址可以使用 HTTP。",
    "core.error.aiConfiguration.invalid-model": "请输入有效的模型名称。",
    "core.error.aiConfiguration.invalid-api-key": "请输入有效的 API Key。",
    "core.error.aiConfiguration.settings-storage-unavailable":
      "当前环境无法访问 AI 设置存储。",
    "core.error.aiConfiguration.key-storage-unavailable":
      "当前环境无法访问 API Key 存储。",
    "core.error.aiConfiguration.missing-configuration":
      "请先完成 AI 配置。",
    "core.error.aiPartition.invalid-intent":
      "请输入有效且长度合适的分区要求。",
    "core.error.aiPartition.invalid-bank":
      "当前题库无效，无法进行 AI 分区。",
    "core.error.aiPartition.request-too-large":
      "当前题库内容超过单次 AI 分区上限。",
    "core.error.aiPartition.invalid-summary":
      "AI 返回的确认摘要无效，请重试。",
    "core.error.aiPartition.invalid-candidate":
      "AI 返回的分区候选无效，请重试。",
    "core.error.aiPartition.bank-mismatch":
      "确认内容不属于当前题库，请重新发起 AI 分区。",
  },
  "en-US": {
    "ai.keyStorage.webPreview":
      "The web preview keeps the API key only for the current browser session. You will need to enter it again after the session closes.",
    "core.error.aiClient.request-too-large": "The AI request is too large.",
    "core.error.aiClient.response-too-large":
      "The AI response is too large and was not processed.",
    "core.error.aiClient.cancelled": "The AI request was cancelled.",
    "core.error.aiClient.timeout": "The AI request timed out. Try again later.",
    "core.error.aiClient.network":
      "Could not connect to the AI service. Check the endpoint and network.",
    "core.error.aiClient.authentication":
      "The API key is invalid or cannot access the selected model.",
    "core.error.aiClient.not-found":
      "The AI endpoint or model was not found. Check the configuration.",
    "core.error.aiClient.rate-limited":
      "The AI service is receiving too many requests. Try again later.",
    "core.error.aiClient.provider":
      "The AI service could not complete the request.",
    "core.error.aiClient.output-limit":
      "The model did not return a complete result within the output limit.",
    "core.error.aiClient.no-visible-output":
      "The model did not return usable final text.",
    "core.error.aiClient.invalid-response":
      "The AI service returned an unrecognized response.",
    "core.error.aiConfiguration.invalid-api-url":
      "Enter a valid AI API endpoint.",
    "core.error.aiConfiguration.insecure-api-url":
      "The AI API must use HTTPS. HTTP is allowed only for local endpoints.",
    "core.error.aiConfiguration.invalid-model": "Enter a valid model name.",
    "core.error.aiConfiguration.invalid-api-key": "Enter a valid API key.",
    "core.error.aiConfiguration.settings-storage-unavailable":
      "AI settings storage is unavailable in this environment.",
    "core.error.aiConfiguration.key-storage-unavailable":
      "API key storage is unavailable in this environment.",
    "core.error.aiConfiguration.missing-configuration":
      "Configure the AI service first.",
    "core.error.aiPartition.invalid-intent":
      "Enter a valid partition request within the length limit.",
    "core.error.aiPartition.invalid-bank":
      "The current question bank is invalid and cannot be partitioned.",
    "core.error.aiPartition.request-too-large":
      "The current question bank exceeds the per-request AI limit.",
    "core.error.aiPartition.invalid-summary":
      "The AI returned an invalid confirmation summary. Try again.",
    "core.error.aiPartition.invalid-candidate":
      "The AI returned an invalid partition candidate. Try again.",
    "core.error.aiPartition.bank-mismatch":
      "The confirmation belongs to another question bank. Start partitioning again.",
  },
} as const;

export type AppLocale = keyof typeof coreMessages;
export type CoreMessageKey = keyof typeof coreMessages["zh-CN"];

const coreErrorMessageKeys = {
  AiClientError: {
    "request-too-large": "core.error.aiClient.request-too-large",
    "response-too-large": "core.error.aiClient.response-too-large",
    cancelled: "core.error.aiClient.cancelled",
    timeout: "core.error.aiClient.timeout",
    network: "core.error.aiClient.network",
    authentication: "core.error.aiClient.authentication",
    "not-found": "core.error.aiClient.not-found",
    "rate-limited": "core.error.aiClient.rate-limited",
    provider: "core.error.aiClient.provider",
    "output-limit": "core.error.aiClient.output-limit",
    "no-visible-output": "core.error.aiClient.no-visible-output",
    "invalid-response": "core.error.aiClient.invalid-response",
  },
  AiConfigurationError: {
    "invalid-api-url": "core.error.aiConfiguration.invalid-api-url",
    "insecure-api-url": "core.error.aiConfiguration.insecure-api-url",
    "invalid-model": "core.error.aiConfiguration.invalid-model",
    "invalid-api-key": "core.error.aiConfiguration.invalid-api-key",
    "settings-storage-unavailable":
      "core.error.aiConfiguration.settings-storage-unavailable",
    "key-storage-unavailable":
      "core.error.aiConfiguration.key-storage-unavailable",
    "missing-configuration":
      "core.error.aiConfiguration.missing-configuration",
  },
  AiPartitionError: {
    "invalid-intent": "core.error.aiPartition.invalid-intent",
    "invalid-bank": "core.error.aiPartition.invalid-bank",
    "request-too-large": "core.error.aiPartition.request-too-large",
    "invalid-summary": "core.error.aiPartition.invalid-summary",
    "invalid-candidate": "core.error.aiPartition.invalid-candidate",
    "bank-mismatch": "core.error.aiPartition.bank-mismatch",
  },
} as const satisfies Readonly<
  Record<string, Readonly<Record<string, CoreMessageKey>>>
>;

interface CodedErrorLike {
  name?: unknown;
  code?: unknown;
}

/**
 * Maps a typed core error to a localized, secret-safe message. This helper
 * intentionally ignores Error.message so provider bodies and keys cannot be
 * reflected into the interface.
 */
export function getCoreErrorMessage(
  locale: AppLocale,
  error: unknown,
): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = error as CodedErrorLike;
  if (typeof candidate.name !== "string" || typeof candidate.code !== "string") {
    return null;
  }
  const family = coreErrorMessageKeys[
    candidate.name as keyof typeof coreErrorMessageKeys
  ];
  if (!family) {
    return null;
  }
  const key = (family as Readonly<Record<string, CoreMessageKey>>)[
    candidate.code
  ];
  return key ? coreMessages[locale][key] : null;
}
