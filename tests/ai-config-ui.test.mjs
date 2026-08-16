import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AiConfigScreen } from "../app/library-screens.tsx";

const officialBaseUrl = "https://api.deepseek.com";

function renderAiConfig(overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(AiConfigScreen, {
      initialValue: {
        providerId: "deepseek",
        baseUrl: officialBaseUrl,
        apiKey: "",
        model: "",
      },
      onBack: () => undefined,
      onDiscoverModels: async () => null,
      onTestConnection: () => undefined,
      onSave: () => undefined,
      ...overrides,
    }),
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function stripMarkup(markup) {
  return markup.replace(/<[^>]+>/gu, "");
}

function findElementByText(html, tagName, text) {
  const elements = html.match(
    new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?</${tagName}>`, "gu"),
  ) ?? [];
  const element = elements.find((candidate) =>
    stripMarkup(candidate).includes(text),
  );
  assert.ok(element, `Expected a <${tagName}> containing ${JSON.stringify(text)}`);
  return element;
}

function findInputByType(html, type) {
  const inputs = html.match(/<input\b[^>]*\/>/gu) ?? [];
  const input = inputs.find((candidate) =>
    candidate.includes(`type="${type}"`),
  );
  assert.ok(input, `Expected an input with type=${JSON.stringify(type)}`);
  return input;
}

function hasAttribute(markup, name) {
  return new RegExp(
    `\\s${escapeRegExp(name)}(?:="[^"]*"|(?=[\\s>]))`,
    "u",
  ).test(markup);
}

function getAttribute(markup, name) {
  return markup.match(
    new RegExp(`\\s${escapeRegExp(name)}="([^"]*)"`, "u"),
  )?.[1];
}

function assertDisabled(markup, expected, label) {
  assert.equal(
    hasAttribute(markup, "disabled"),
    expected,
    `${label} should be ${expected ? "disabled" : "enabled"}`,
  );
}

function getActionButtons(html) {
  return {
    detect: findElementByText(html, "button", "检测上游模型"),
    testConnection: findElementByText(html, "button", "测试连接"),
    save: findElementByText(html, "button", "保存配置"),
  };
}

test("renders all providers, locked official metadata, and safe external links", () => {
  const html = renderAiConfig();
  const select = html.match(/<select\b[^>]*>([\s\S]*?)<\/select>/u);
  assert.ok(select, "Expected the provider selector");

  const providerIds = [...select[1].matchAll(/<option\b[^>]*value="([^"]+)"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(providerIds, [
    "openai",
    "deepseek",
    "gemini",
    "qwen",
    "doubao",
    "glm",
    "kimi",
    "minimax-cn",
    "minimax-global",
    "xai",
    "custom-openai",
  ]);
  assert.match(
    select[1],
    /<option value="deepseek" selected="">DeepSeek<\/option>/u,
  );

  const baseUrlInput = findInputByType(html, "url");
  assert.equal(getAttribute(baseUrlInput, "value"), officialBaseUrl);
  assert.equal(hasAttribute(baseUrlInput, "readOnly"), true);
  assert.equal(getAttribute(baseUrlInput, "aria-readonly"), "true");

  const linksBlock = html.match(
    /<div class="ai-provider-links">([\s\S]*?)<\/div>/u,
  );
  assert.ok(linksBlock, "Expected official provider links");
  const links = linksBlock[1].match(/<a\b[^>]*>[\s\S]*?<\/a>/gu) ?? [];
  assert.equal(links.length, 3);
  assert.deepEqual(
    links.map((link) => getAttribute(link, "href")),
    [
      "https://www.deepseek.com/",
      "https://api-docs.deepseek.com/",
      "https://platform.deepseek.com/api_keys",
    ],
  );
  assert.deepEqual(
    links.map((link) => stripMarkup(link)),
    ["官网（在新窗口打开）", "API 文档（在新窗口打开）", "获取 API Key（在新窗口打开）"],
  );
  for (const link of links) {
    assert.equal(getAttribute(link, "target"), "_blank");
    assert.equal(getAttribute(link, "rel"), "noopener noreferrer");
  }
});

test("progressively enables discovery, connection testing, and saving", () => {
  const blank = getActionButtons(renderAiConfig());
  assertDisabled(blank.detect, true, "model discovery");
  assertDisabled(blank.testConnection, true, "connection test");
  assertDisabled(blank.save, true, "save");

  const readyToDiscover = getActionButtons(renderAiConfig({
    initialValue: {
      providerId: "deepseek",
      baseUrl: officialBaseUrl,
      apiKey: "sk-test",
      model: "",
    },
  }));
  assertDisabled(readyToDiscover.detect, false, "model discovery");
  assertDisabled(readyToDiscover.testConnection, true, "connection test");
  assertDisabled(readyToDiscover.save, true, "save");

  const readyToTest = getActionButtons(renderAiConfig({
    initialValue: {
      providerId: "deepseek",
      baseUrl: officialBaseUrl,
      apiKey: "sk-test",
      model: "deepseek-chat",
    },
    status: "changed",
  }));
  assertDisabled(readyToTest.detect, false, "model discovery");
  assertDisabled(readyToTest.testConnection, false, "connection test");
  assertDisabled(readyToTest.save, true, "save");

  const connectedHtml = renderAiConfig({
    initialValue: {
      providerId: "deepseek",
      baseUrl: officialBaseUrl,
      apiKey: "sk-test",
      model: "deepseek-chat",
    },
    status: "connected",
  });
  const connected = getActionButtons(connectedHtml);
  assertDisabled(connected.detect, false, "model discovery");
  assertDisabled(connected.testConnection, false, "connection test");
  assertDisabled(connected.save, false, "save");

  const liveRegion = connectedHtml.match(
    /<section\b[^>]*class="ai-connection-status connected"[^>]*>/u,
  );
  assert.ok(liveRegion, "Expected the connected status region");
  assert.equal(getAttribute(liveRegion[0], "aria-live"), "polite");
  assert.equal(getAttribute(liveRegion[0], "role"), "status");
  assert.equal(getAttribute(liveRegion[0], "aria-label"), "模型连接状态");
  assert.match(connectedHtml, /<strong>已连接<\/strong>/u);

  const errorHtml = renderAiConfig({ status: "error" });
  assert.match(
    errorHtml,
    /<section\b[^>]*class="ai-connection-status error"[^>]*role="alert"/u,
  );
});

test("renders the manual model entry and an editable custom endpoint warning", () => {
  const manualHtml = renderAiConfig({
    initialValue: {
      providerId: "deepseek",
      baseUrl: officialBaseUrl,
      apiKey: "sk-test",
      model: "account-specific-model",
    },
  });
  const manualToggle = findElementByText(
    manualHtml,
    "button",
    "手动填写模型 ID",
  );
  assert.equal(getAttribute(manualToggle, "aria-expanded"), "true");
  const manualInput = manualHtml.match(
    /<input\b[^>]*value="account-specific-model"[^>]*\/>/u,
  );
  assert.ok(manualInput, "Expected the manual model input");
  assert.equal(hasAttribute(manualInput[0], "disabled"), false);

  const customUrl = "https://gateway.example/v1";
  const customHtml = renderAiConfig({
    initialValue: {
      providerId: "custom-openai",
      baseUrl: customUrl,
      apiKey: "",
      model: "",
    },
  });
  const customBaseUrlInput = findInputByType(customHtml, "url");
  assert.equal(getAttribute(customBaseUrlInput, "value"), customUrl);
  assert.equal(hasAttribute(customBaseUrlInput, "readOnly"), false);
  assert.equal(getAttribute(customBaseUrlInput, "aria-readonly"), "false");
  assert.match(
    customHtml,
    /<div class="ai-custom-provider-warning" role="note">/u,
  );
  assert.match(customHtml, /确认密钥发送地址/u);
  assert.match(customHtml, /https:\/\/gateway\.example\/v1/u);
});

test("keeps provider identity and model safety rules in the callback flow", async () => {
  const source = await readFile(
    new URL("../app/library-screens.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /export interface AiConfigValue\s*\{[\s\S]*?providerId:\s*string;/u,
  );
  assert.match(
    source,
    /const value = \{[\s\S]*?providerId:\s*provider\.id,[\s\S]*?\n  \};/u,
  );
  assert.match(source, /onTestConnection\(value\)/u);
  assert.match(source, /onSave\(value\)/u);

  const chooseProvider = source.match(
    /const chooseProvider = \([\s\S]*?\n  \};\n\n  const handleDiscovery/u,
  );
  assert.ok(chooseProvider, "Expected the provider-selection handler");
  assert.match(chooseProvider[0], /setApiKey\(""\)/u);
  assert.match(chooseProvider[0], /setModel\(""\)/u);

  const handleDiscovery = source.match(
    /const handleDiscovery = async \(\) => \{[\s\S]*?\n  \};\n\n  const selectModel/u,
  );
  assert.ok(handleDiscovery, "Expected the model-discovery handler");
  assert.doesNotMatch(handleDiscovery[0], /setModel\s*\(/u);
  assert.match(handleDiscovery[0], /onDiscoverModels\(requestValue\)/u);

  assert.match(
    source,
    /const savedModelMissing = Boolean\([\s\S]*?isModelMissingFromUpstream\(/u,
  );
  assert.match(
    source,
    /savedModelMissing \? \([\s\S]*?className="ai-model-missing" role="alert"/u,
  );
  assert.match(source, /tabIndex=\{tabbableModelId === candidate\.id \? 0 : -1\}/u);
  assert.match(source, /if \(event\.key === "Escape"\)/u);
  assert.match(source, /clearCancelRef\.current\?\.focus\(\)/u);
  assert.match(source, /trigger\.focus\(\)/u);
  assert.match(source, /const clearRequest = Promise\.resolve\(\)\.then\(onClear\)/u);
  assert.match(source, /document\.getElementById\(AI_CONFIG_STATUS_ID\)\?\.focus\(\)/u);
  assert.match(source, /clearReturnToStatusRef\.current = true/u);
  assert.match(source, /tabIndex=\{-1\}/u);
});

test("binds async test state to the active draft and labels platform key storage", async () => {
  const secureHtml = renderAiConfig({ keyStorageSecurity: "secure" });
  assert.match(secureHtml, /Android 使用系统密钥库加密保存当前 API Key/u);
  assert.doesNotMatch(secureHtml, /仅在当前浏览器会话中保存 API Key/u);

  const appSource = await readFile(
    new URL("../app/quiz-app.tsx", import.meta.url),
    "utf8",
  );
  assert.match(appSource, /const aiConfigRequestIdRef = useRef\(0\)/u);
  assert.match(appSource, /requestId !== aiConfigRequestIdRef\.current/u);
  assert.match(appSource, /aiConfigAbortControllerRef\.current\?\.abort\(\)/u);
  assert.match(
    appSource,
    /onBack=\{\(\) => \{[\s\S]*?setAiConfigStatus\(aiConfiguration \? "saved" : "unconfigured"\)/u,
  );
  assert.match(appSource, /keyStorageSecurity=\{aiApiKeyStore\.security\}/u);
});
