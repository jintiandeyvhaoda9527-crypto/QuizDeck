import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_PROVIDER_DEFINITIONS,
  AI_PROVIDER_IDS,
  CUSTOM_AI_PROVIDER_ID,
  DEFAULT_AI_PROVIDER_ID,
  buildAiProviderResourceUrl,
  getAiProviderDefinition,
  inferAiProviderIdFromApiBaseUrl,
  isCustomAiProviderId,
  isOfficialAiProvider,
  isOfficialAiProviderApiBaseUrl,
  isOfficialAiProviderId,
  tryGetAiProviderDefinition,
} from "../app/ai-providers.ts";

test("服务商注册表完整且 ID、官方主机名唯一", () => {
  assert.equal(DEFAULT_AI_PROVIDER_ID, "deepseek");
  assert.equal(CUSTOM_AI_PROVIDER_ID, "custom-openai");
  assert.deepEqual(
    AI_PROVIDER_DEFINITIONS.map(({ id }) => id),
    [...AI_PROVIDER_IDS],
  );
  assert.equal(
    new Set(AI_PROVIDER_DEFINITIONS.map(({ id }) => id)).size,
    AI_PROVIDER_DEFINITIONS.length,
  );

  const officialHostnames = AI_PROVIDER_DEFINITIONS.filter(
    ({ lockedBaseUrl }) => lockedBaseUrl,
  ).map(({ defaultBaseUrl }) => new URL(defaultBaseUrl).hostname);
  assert.equal(
    new Set(officialHostnames).size,
    officialHostnames.length,
  );
});

test("官方预设仅使用 HTTPS，自定义服务不预填外部 URL", () => {
  for (const definition of AI_PROVIDER_DEFINITIONS) {
    assert.equal(definition.protocol, "openai-chat");
    assert.equal(definition.discoveryMode, "openai-models");
    assert.ok(definition.name);
    assert.ok(definition.nameEn);

    const urls = [
      definition.homepageUrl,
      definition.docsUrl,
      definition.apiKeyUrl,
      definition.defaultBaseUrl,
    ];
    if (definition.id === CUSTOM_AI_PROVIDER_ID) {
      assert.deepEqual(urls, ["", "", "", ""]);
      assert.equal(definition.lockedBaseUrl, false);
      assert.deepEqual(definition.fallbackModels, []);
      continue;
    }

    assert.equal(definition.lockedBaseUrl, true);
    assert.ok(definition.fallbackModels.length > 0);
    for (const value of urls) {
      assert.equal(new URL(value).protocol, "https:");
    }
  }

  assert.equal(
    getAiProviderDefinition("minimax-cn").defaultBaseUrl,
    "https://api.minimaxi.com/v1",
  );
  assert.equal(
    getAiProviderDefinition("minimax-global").defaultBaseUrl,
    "https://api.minimax.io/v1",
  );
  assert.equal(tryGetAiProviderDefinition("missing-provider"), undefined);
  assert.throws(
    () => getAiProviderDefinition("missing-provider"),
    RangeError,
  );
});

test("只按 HTTPS 官方精确主机名推断服务商", () => {
  assert.equal(
    inferAiProviderIdFromApiBaseUrl("https://api.deepseek.com"),
    "deepseek",
  );
  assert.equal(
    inferAiProviderIdFromApiBaseUrl("https://api.deepseek.com/v1"),
    "deepseek",
  );
  assert.equal(
    inferAiProviderIdFromApiBaseUrl(
      "https://generativelanguage.googleapis.com/v1beta/openai",
    ),
    "gemini",
  );
  assert.equal(
    inferAiProviderIdFromApiBaseUrl("https://api.deepseek.com.example/v1"),
    CUSTOM_AI_PROVIDER_ID,
  );
  assert.equal(
    inferAiProviderIdFromApiBaseUrl("http://api.deepseek.com/v1"),
    CUSTOM_AI_PROVIDER_ID,
  );
  assert.equal(
    inferAiProviderIdFromApiBaseUrl("https://api.deepseek.com:8443/v1"),
    CUSTOM_AI_PROVIDER_ID,
  );
  assert.equal(
    inferAiProviderIdFromApiBaseUrl("not a URL"),
    CUSTOM_AI_PROVIDER_ID,
  );

  assert.equal(isOfficialAiProviderId("deepseek"), true);
  assert.equal(
    isOfficialAiProvider(getAiProviderDefinition("deepseek")),
    true,
  );
  assert.equal(isOfficialAiProvider("missing-provider"), false);
  assert.equal(isOfficialAiProviderId(CUSTOM_AI_PROVIDER_ID), false);
  assert.equal(isCustomAiProviderId(CUSTOM_AI_PROVIDER_ID), true);
  assert.equal(
    isOfficialAiProviderApiBaseUrl("https://api.deepseek.com/v1"),
    true,
  );
  assert.equal(
    isOfficialAiProviderApiBaseUrl("https://api.deepseek.com.evil.test"),
    false,
  );
});

test("资源地址按 v2 基础地址精确追加且不擅自插入 /v1", () => {
  const fixtures = [
    [
      "https://generativelanguage.googleapis.com/v1beta/openai",
      "https://generativelanguage.googleapis.com/v1beta/openai/models",
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    ],
    [
      "https://ark.cn-beijing.volces.com/api/v3",
      "https://ark.cn-beijing.volces.com/api/v3/models",
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    ],
    [
      "https://open.bigmodel.cn/api/paas/v4",
      "https://open.bigmodel.cn/api/paas/v4/models",
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    ],
  ];

  for (const [baseUrl, modelsUrl, chatUrl] of fixtures) {
    assert.equal(buildAiProviderResourceUrl(baseUrl, "models"), modelsUrl);
    assert.equal(
      buildAiProviderResourceUrl(baseUrl, "chat/completions"),
      chatUrl,
    );
  }

  assert.equal(
    buildAiProviderResourceUrl(
      "https://api.deepseek.com",
      "chat/completions",
    ),
    "https://api.deepseek.com/chat/completions",
  );
  assert.equal(
    buildAiProviderResourceUrl(
      "https://example.com/proxy/chat/completions",
      "chat/completions",
    ),
    "https://example.com/proxy/chat/completions",
  );
  assert.equal(
    buildAiProviderResourceUrl(
      "https://example.com/proxy/chat/completions",
      "models",
    ),
    "https://example.com/proxy/models",
  );
});
