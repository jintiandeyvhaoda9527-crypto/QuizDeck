import { Capacitor, registerPlugin } from "@capacitor/core";

export const MAX_AI_HTTP_RESPONSE_CHARS = 320_000;
export const MAX_AI_HTTP_REQUEST_CHARS = 9_100_000;

export interface AiHttpRequest {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: Readonly<Record<string, unknown>>;
  timeoutMs: number;
  signal?: AbortSignal;
}

export type AiHttpGetRequest = Omit<AiHttpRequest, "body">;

export interface AiHttpResponse {
  status: number;
  data: unknown;
  headers?: Readonly<Record<string, string>>;
}

export interface AiHttpTransport {
  getJson(request: AiHttpGetRequest): Promise<AiHttpResponse>;
  postJson(request: AiHttpRequest): Promise<AiHttpResponse>;
}

interface NativeAiHttpRequest {
  requestId: string;
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

interface NativeAiHttpResult {
  status?: number;
  data?: unknown;
  errorCode?: "cancelled" | "timeout" | "response-too-large" | "network";
}

interface NativeAiHttpPlugin {
  request(options: NativeAiHttpRequest): Promise<NativeAiHttpResult>;
  cancel(options: { requestId: string }): Promise<void>;
}

const NativeAiHttp = registerPlugin<NativeAiHttpPlugin>("AiHttp");
let nativeAiHttpRequestSequence = 0;

function createNativeAiHttpRequestId() {
  nativeAiHttpRequestSequence = (nativeAiHttpRequestSequence + 1) %
    Number.MAX_SAFE_INTEGER;
  return `quizdeck-ai-${Date.now()}-${nativeAiHttpRequestSequence}`;
}

export type AiClientErrorCode =
  | "request-too-large"
  | "response-too-large"
  | "cancelled"
  | "timeout"
  | "network"
  | "browser-direct-unavailable"
  | "authentication"
  | "permission-denied"
  | "payment-required"
  | "not-found"
  | "rate-limited"
  | "invalid-parameters"
  | "service-unavailable"
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

export function cancelledAiRequestError() {
  return new AiClientError("cancelled", "已取消 AI 请求。");
}

export function throwIfAiRequestCancelled(
  signal: AbortSignal | undefined,
) {
  if (signal?.aborted) {
    throw cancelledAiRequestError();
  }
}

// Short aliases keep the helpers convenient for protocol adapters.
export const cancelledError = cancelledAiRequestError;
export const throwIfCancelled = throwIfAiRequestCancelled;

export function assertAiHttpResponseWithinLimit(
  data: unknown,
  maximumChars = MAX_AI_HTTP_RESPONSE_CHARS,
) {
  let length = 0;
  if (typeof data === "string") {
    length = data.length;
  } else {
    try {
      const serialized = JSON.stringify(data);
      length = typeof serialized === "string" ? serialized.length : 0;
    } catch {
      throw new AiClientError(
        "invalid-response",
        "AI 服务返回了无法识别的数据。",
      );
    }
  }

  if (length > maximumChars) {
    throw new AiClientError(
      "response-too-large",
      "AI 返回的数据过大，已停止读取。",
    );
  }
}

async function readFetchResponseWithLimit(
  response: Response,
  maximumChars: number,
) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumChars * 4
  ) {
    throw new AiClientError(
      "response-too-large",
      "AI 返回的数据过大，已停止读取。",
    );
  }

  if (!response.body) {
    const text = await response.text();
    assertAiHttpResponseWithinLimit(text, maximumChars);
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
        assertAiHttpResponseWithinLimit(text, maximumChars);
        break;
      }
      text += decoder.decode(result.value, { stream: true });
      if (text.length > maximumChars) {
        try {
          await reader.cancel();
        } catch {
          // The bounded response error is more useful than a cancel failure.
        }
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

function timeoutError() {
  return new AiClientError(
    "timeout",
    "AI 请求超时，请稍后重试。",
  );
}

async function runWithRequestDeadline<T>(
  request: AiHttpGetRequest,
  operation: () => Promise<T>,
  abortOperation: () => void,
) {
  throwIfAiRequestCancelled(request.signal);

  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancelRequest: (() => void) | undefined;
  const operationPromise = operation();
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = globalThis.setTimeout(() => {
      timedOut = true;
      abortOperation();
      reject(timeoutError());
    }, request.timeoutMs);
  });
  const requests: Array<Promise<T>> = [
    operationPromise,
    timeoutPromise,
  ];

  if (request.signal) {
    requests.push(
      new Promise<never>((_, reject) => {
        cancelRequest = () => {
          abortOperation();
          reject(cancelledAiRequestError());
        };
        request.signal?.addEventListener("abort", cancelRequest, {
          once: true,
        });
        if (request.signal?.aborted) {
          cancelRequest();
        }
      }),
    );
  }

  try {
    return await Promise.race(requests);
  } catch (error) {
    if (request.signal?.aborted) {
      throw cancelledAiRequestError();
    }
    if (timedOut) {
      throw timeoutError();
    }
    throw error;
  } finally {
    if (timeout !== undefined) {
      globalThis.clearTimeout(timeout);
    }
    if (cancelRequest) {
      request.signal?.removeEventListener("abort", cancelRequest);
    }
  }
}

function isAbortError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError",
  );
}

function isRealBrowserWindow() {
  return (globalThis as typeof globalThis & { window?: unknown }).window ===
    globalThis;
}

function responseHeaders(response: Response) {
  return Object.fromEntries(response.headers.entries());
}

function serializeAiHttpRequestBody(
  body: Readonly<Record<string, unknown>>,
) {
  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch {
    throw new AiClientError(
      "request-too-large",
      "AI 请求内容无法序列化。",
    );
  }
  if (serialized.length > MAX_AI_HTTP_REQUEST_CHARS) {
    throw new AiClientError(
      "request-too-large",
      "AI 请求内容过大。",
    );
  }
  return serialized;
}

type AiHttpMethod = "GET" | "POST";

async function executeBrowserRequest(
  method: AiHttpMethod,
  request: AiHttpGetRequest | AiHttpRequest,
) {
  throwIfAiRequestCancelled(request.signal);
  if (typeof globalThis.fetch !== "function") {
    throw new AiClientError(
      "network",
      "当前环境不支持访问 AI 服务。",
    );
  }

  const controller = new AbortController();
  const serializedBody = method === "POST"
    ? serializeAiHttpRequestBody((request as AiHttpRequest).body)
    : undefined;
  let directFetchError: unknown;
  try {
    return await runWithRequestDeadline(
      request,
      async () => {
        const init: RequestInit = {
          method,
          headers: request.headers,
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
          credentials: "omit",
        };
        if (serializedBody !== undefined) {
          init.body = serializedBody;
        }

        let response: Response;
        try {
          response = await globalThis.fetch(request.url, init);
        } catch (error) {
          directFetchError = error;
          throw error;
        }
        throwIfAiRequestCancelled(request.signal);

        if (!response.ok) {
          return {
            status: response.status,
            data: null,
            headers: responseHeaders(response),
          };
        }

        const text = await readFetchResponseWithLimit(
          response,
          MAX_AI_HTTP_RESPONSE_CHARS,
        );
        throwIfAiRequestCancelled(request.signal);
        return {
          status: response.status,
          data: text,
          headers: responseHeaders(response),
        };
      },
      () => controller.abort(),
    );
  } catch (error) {
    if (request.signal?.aborted) {
      throw cancelledAiRequestError();
    }
    if (error instanceof AiClientError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new AiClientError(
        "network",
        "AI 请求被意外中止，请重试。",
      );
    }
    if (
      error === directFetchError &&
      error instanceof TypeError &&
      isRealBrowserWindow()
    ) {
      throw new AiClientError(
        "browser-direct-unavailable",
        "浏览器无法直接访问 AI 服务，可能是 CORS 限制或网络故障。请检查网络，或改用支持直接访问的环境。",
      );
    }
    throw new AiClientError(
      "network",
      "无法连接 AI 服务，请检查地址和网络。",
    );
  }
}

export function createWebAiHttpTransport(): AiHttpTransport {
  return {
    getJson(request) {
      return executeBrowserRequest("GET", request);
    },
    postJson(request) {
      return executeBrowserRequest("POST", request);
    },
  };
}

async function executeCapacitorRequest(
  method: AiHttpMethod,
  request: AiHttpGetRequest | AiHttpRequest,
) {
  throwIfAiRequestCancelled(request.signal);
  const requestId = createNativeAiHttpRequestId();
  const serializedBody = method === "POST"
    ? serializeAiHttpRequestBody((request as AiHttpRequest).body)
    : undefined;
  try {
    const response = await runWithRequestDeadline(
      request,
      () =>
        NativeAiHttp.request({
          requestId,
          url: request.url,
          method,
          headers: { ...request.headers },
          timeoutMs: request.timeoutMs,
          ...(serializedBody === undefined ? {} : { body: serializedBody }),
        }),
      () => {
        void NativeAiHttp.cancel({ requestId }).catch(() => undefined);
      },
    );
    throwIfAiRequestCancelled(request.signal);
    if (response.errorCode) {
      if (response.errorCode === "cancelled") {
        throw cancelledAiRequestError();
      }
      if (response.errorCode === "timeout") {
        throw timeoutError();
      }
      if (response.errorCode === "response-too-large") {
        throw new AiClientError(
          "response-too-large",
          "AI 返回的数据过大，已停止读取。",
        );
      }
      throw new AiClientError(
        "network",
        "无法连接 AI 服务，请检查地址和网络。",
      );
    }
    if (typeof response.status !== "number") {
      throw new AiClientError(
        "invalid-response",
        "AI 服务返回了无法识别的数据。",
      );
    }
    const data = response.data ?? null;
    if (response.status < 200 || response.status >= 300) {
      return { status: response.status, data };
    }
    assertAiHttpResponseWithinLimit(data);
    return {
      status: response.status,
      data,
    };
  } catch (error) {
    if (request.signal?.aborted) {
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
}

export function createCapacitorAiHttpTransport(): AiHttpTransport {
  return {
    getJson(request) {
      return executeCapacitorRequest("GET", request);
    },
    postJson(request) {
      return executeCapacitorRequest("POST", request);
    },
  };
}

export function createDefaultAiHttpTransport(): AiHttpTransport {
  return Capacitor.isNativePlatform()
    ? createCapacitorAiHttpTransport()
    : createWebAiHttpTransport();
}

export function throwForAiHttpStatus(status: number) {
  if (status === 401) {
    throw new AiClientError(
      "authentication",
      "API Key 无效（HTTP 401）。",
      status,
    );
  }
  if (status === 403) {
    throw new AiClientError(
      "permission-denied",
      "当前账号没有访问该接口或模型的权限（HTTP 403）。",
      status,
    );
  }
  if (status === 402) {
    throw new AiClientError(
      "payment-required",
      "AI 账户余额不足，请充值后重试（HTTP 402）。",
      status,
    );
  }
  if (status === 404 || status === 405) {
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
      "invalid-parameters",
      "AI 服务无法处理当前参数，请检查模型名称和接口配置（HTTP 422）。",
      status,
    );
  }
  if (status >= 500) {
    throw new AiClientError(
      "service-unavailable",
      "AI 服务暂时不可用或繁忙，请稍后重试。",
      status,
    );
  }
  if (status < 200 || status >= 300) {
    throw new AiClientError(
      "provider",
      "AI 服务拒绝了请求，请检查配置。",
      status,
    );
  }
}
