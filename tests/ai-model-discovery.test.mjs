import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_DISCOVERED_AI_MODELS,
  discoverOpenAiModels,
  filterAiModels,
  getFallbackAiModels,
  isModelMissingFromUpstream,
  parseOpenAiModelList,
} from "../app/ai-model-discovery.ts";
import { AiClientError } from "../app/ai-transport.ts";

const SECRET_API_KEY = "sk-secret?token=#fragment";

function connection(providerId, apiBaseUrl, apiKey = SECRET_API_KEY) {
  return {
    providerId,
    protocol: "openai-chat",
    apiBaseUrl,
    apiKey,
    timeoutMs: 31_000,
  };
}

function fixedTransport(status, data, calls = []) {
  return {
    async getJson(request) {
      calls.push({ method: "GET", request });
      return { status, data };
    },
    async postJson(request) {
      calls.push({ method: "POST", request });
      throw new Error("Model discovery must not probe individual models.");
    },
  };
}

test("模型发现对各官方服务商只发送一次精确的 GET /models", async (t) => {
  const fixtures = [
    {
      providerId: "deepseek",
      apiBaseUrl: "https://api.deepseek.com",
      modelsUrl: "https://api.deepseek.com/models",
    },
    {
      providerId: "gemini",
      apiBaseUrl:
        "https://generativelanguage.googleapis.com/v1beta/openai",
      modelsUrl:
        "https://generativelanguage.googleapis.com/v1beta/openai/models",
    },
    {
      providerId: "doubao",
      apiBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      modelsUrl: "https://ark.cn-beijing.volces.com/api/v3/models",
    },
    {
      providerId: "glm",
      apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
      modelsUrl: "https://open.bigmodel.cn/api/paas/v4/models",
    },
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.providerId, async () => {
      const calls = [];
      const result = await discoverOpenAiModels(
        connection(fixture.providerId, fixture.apiBaseUrl),
        {
          transport: fixedTransport(
            200,
            { data: [{ id: `${fixture.providerId}-chat` }] },
            calls,
          ),
        },
      );

      assert.equal(result.source, "upstream");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, "GET");
      assert.equal(calls[0].request.url, fixture.modelsUrl);
      assert.equal(calls[0].request.url.includes(SECRET_API_KEY), false);
      assert.deepEqual(calls[0].request.headers, {
        Authorization: `Bearer ${SECRET_API_KEY}`,
        Accept: "application/json",
      });
      assert.equal("body" in calls[0].request, false);
    });
  }
});

test("模型列表兼容标准、别名、嵌套和 JSON 字符串响应", async (t) => {
  const fixtures = [
    ["bare array", [{ id: "bare-model" }], "bare-model"],
    ["OpenAI data", { data: [{ id: "data-model" }] }, "data-model"],
    ["models alias", { models: [{ model: "alias-model" }] }, "alias-model"],
    [
      "nested data",
      { data: { data: [{ id: "nested-data-model" }] } },
      "nested-data-model",
    ],
    [
      "nested models JSON",
      JSON.stringify({
        data: {
          models: [{
            name: "models/nested-model",
            displayName: "Nested model",
          }],
        },
      }),
      "nested-model",
    ],
  ];

  for (const [name, payload, expectedId] of fixtures) {
    await t.test(name, () => {
      assert.deepEqual(
        parseOpenAiModelList(payload).map(({ id }) => id),
        [expectedId],
      );
    });
  }
});

test("模型列表去重、过滤非聊天模型并按推荐度、稳定性和名称排序", () => {
  const models = parseOpenAiModelList(
    {
      data: [
        {
          id: "reason-r1-preview",
          displayName: "Reasoning preview",
          owned_by: "reasoning-lab",
          context_window: 12_345.9,
        },
        { id: "general-10", displayName: "General 10" },
        { id: "preferred-two", displayName: "Preferred two" },
        {
          id: "preferred-one",
          displayName: "Preferred one",
          ownedBy: "preferred-owner",
          inputTokenLimit: 12_000_000,
        },
        { id: "preferred-one", displayName: "Ignored duplicate" },
        { id: "general-2", displayName: "General 2" },
        { id: "text-embedding-3-small" },
        { id: "image-generator" },
        { id: "voice-tts-1" },
        { id: "omni-moderation-latest" },
        { id: "whisper-1" },
        { id: "davinci-002" },
        { id: "contains spaces" },
        { id: "" },
        null,
      ],
    },
    ["preferred-one", "preferred-two"],
  );

  assert.deepEqual(
    models.map(({ id }) => id),
    [
      "preferred-one",
      "preferred-two",
      "general-2",
      "general-10",
      "reason-r1-preview",
    ],
  );
  assert.deepEqual(models[0], {
    id: "preferred-one",
    name: "Preferred one",
    ownedBy: "preferred-owner",
    contextWindow: 10_000_000,
    releaseStage: "stable",
    recommended: true,
  });
  assert.deepEqual(models[1], {
    id: "preferred-two",
    name: "Preferred two",
    releaseStage: "stable",
    recommended: true,
  });
  assert.deepEqual(models[4], {
    id: "reason-r1-preview",
    name: "Reasoning preview",
    ownedBy: "reasoning-lab",
    isReasoning: true,
    contextWindow: 12_345,
    releaseStage: "preview",
    recommended: false,
  });
});

test("模型搜索匹配名称、ID 和所属方且不修改原列表", () => {
  const models = parseOpenAiModelList({
    data: [
      {
        id: "alpha-chat",
        displayName: "Alpha Assistant",
        owned_by: "Example Labs",
      },
      { id: "beta-pro", displayName: "Beta Pro" },
    ],
  });

  assert.deepEqual(
    filterAiModels(models, " assistant ").map(({ id }) => id),
    ["alpha-chat"],
  );
  assert.deepEqual(
    filterAiModels(models, "BETA-PRO").map(({ id }) => id),
    ["beta-pro"],
  );
  assert.deepEqual(
    filterAiModels(models, "example labs").map(({ id }) => id),
    ["alpha-chat"],
  );
  const unfiltered = filterAiModels(models, "   ");
  assert.deepEqual(unfiltered, models);
  assert.notEqual(unfiltered, models);
});

test("模型发现最多保留 500 个模型并标记实时列表已截断", async () => {
  const payload = {
    data: Array.from(
      { length: MAX_DISCOVERED_AI_MODELS + 1 },
      (_, index) => ({ id: `chat-${String(index).padStart(3, "0")}` }),
    ),
  };
  const before = Date.now();
  const result = await discoverOpenAiModels(
    connection("deepseek", "https://api.deepseek.com"),
    { transport: fixedTransport(200, payload) },
  );
  const after = Date.now();

  assert.equal(result.source, "upstream");
  assert.equal(result.models.length, MAX_DISCOVERED_AI_MODELS);
  assert.equal(result.models[0].id, "chat-000");
  assert.equal(result.models.at(-1).id, "chat-499");
  assert.equal(result.truncated, true);
  assert.ok(result.detectedAt >= before && result.detectedAt <= after);
});

test("404 和 405 使用内置模型回退且不伪造检测时间", async (t) => {
  for (const status of [404, 405]) {
    await t.test(String(status), async () => {
      const result = await discoverOpenAiModels(
        connection("deepseek", "https://api.deepseek.com"),
        { transport: fixedTransport(status, null) },
      );

      assert.equal(result.source, "fallback");
      assert.equal(result.warning, "unsupported");
      assert.deepEqual(result.models, getFallbackAiModels("deepseek"));
      assert.equal("detectedAt" in result, false);
    });
  }
});

test("浏览器直连不可用时保留内置模型和明确警告", async () => {
  const result = await discoverOpenAiModels(
    connection("deepseek", "https://api.deepseek.com"),
    {
      transport: {
        async getJson() {
          throw new AiClientError(
            "browser-direct-unavailable",
            "浏览器无法直接访问此服务。",
          );
        },
      },
    },
  );

  assert.equal(result.source, "fallback");
  assert.equal(result.warning, "browser-direct-unavailable");
  assert.deepEqual(result.models, getFallbackAiModels("deepseek"));
  assert.equal("detectedAt" in result, false);
});

test("空列表和畸形响应安全回退且不伪造检测时间", async (t) => {
  const fixtures = [
    ["empty array", { data: [] }, "empty"],
    [
      "only non-chat models",
      { data: [{ id: "text-embedding-3-small" }] },
      "empty",
    ],
    ["malformed JSON", "{not-json", "invalid-response"],
    ["unknown shape", { items: [{ id: "chat-model" }] }, "invalid-response"],
  ];

  for (const [name, payload, warning] of fixtures) {
    await t.test(name, async () => {
      const result = await discoverOpenAiModels(
        connection("deepseek", "https://api.deepseek.com"),
        { transport: fixedTransport(200, payload) },
      );

      assert.equal(result.source, "fallback");
      assert.equal(result.warning, warning);
      assert.deepEqual(result.models, getFallbackAiModels("deepseek"));
      assert.equal("detectedAt" in result, false);
    });
  }
});

test("401、403 和 429 保留分类错误而不降级为内置模型", async (t) => {
  const fixtures = [
    [401, "authentication"],
    [403, "permission-denied"],
    [429, "rate-limited"],
  ];

  for (const [status, code] of fixtures) {
    await t.test(String(status), async () => {
      await assert.rejects(
        discoverOpenAiModels(
          connection("deepseek", "https://api.deepseek.com"),
          { transport: fixedTransport(status, null) },
        ),
        (error) => {
          assert.ok(error instanceof AiClientError);
          assert.equal(error.code, code);
          assert.equal(error.status, status);
          assert.equal(String(error).includes(SECRET_API_KEY), false);
          return true;
        },
      );
    });
  }
});

test("只有实时成功列表缺少已保存模型时才报告下线", () => {
  const liveResult = {
    source: "upstream",
    detectedAt: Date.now(),
    models: [{ id: "available", name: "Available", recommended: false }],
  };
  const fallbackResult = {
    source: "fallback",
    warning: "unsupported",
    models: getFallbackAiModels("deepseek"),
  };

  assert.equal(isModelMissingFromUpstream("missing", liveResult), true);
  assert.equal(isModelMissingFromUpstream("available", liveResult), false);
  assert.equal(isModelMissingFromUpstream("missing", fallbackResult), false);
  assert.equal(isModelMissingFromUpstream("missing", null), false);
  assert.equal(isModelMissingFromUpstream("", liveResult), false);
});

test("模型发现原样传递调用方 AbortSignal", async () => {
  const controller = new AbortController();
  let receivedSignal;
  const result = await discoverOpenAiModels(
    connection("deepseek", "https://api.deepseek.com"),
    {
      signal: controller.signal,
      transport: {
        async getJson(request) {
          receivedSignal = request.signal;
          return { status: 200, data: { data: [{ id: "chat-model" }] } };
        },
      },
    },
  );

  assert.equal(result.source, "upstream");
  assert.equal(receivedSignal, controller.signal);
});
