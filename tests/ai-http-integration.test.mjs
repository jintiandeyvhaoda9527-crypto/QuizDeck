import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { once } from "node:events";

import {
  AiClientError,
  createOpenAiCompatibleClient,
  generatePartitionCandidate,
  testAiConnection,
} from "../app/ai-core.ts";

function createQuestion(index) {
  return {
    id: `integration-bank:q-${index}`,
    number: index,
    sourceRow: index + 1,
    type: "single",
    stem: index % 2 === 0 ? `第 ${index} 题：安全要求` : `第 ${index} 题`,
    options: [
      { id: "A", text: "选项 A" },
      { id: "B", text: "选项 B" },
    ],
    answerKeys: ["A"],
    answerText: null,
    gradable: true,
    optionOrderLocked: false,
    sourceIssue: null,
  };
}

function createBank(questionCount) {
  return {
    id: "integration-bank",
    name: "HTTP 集成题库",
    questions: Array.from(
      { length: questionCount },
      (_, index) => createQuestion(index + 1),
    ),
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
  }
  return JSON.parse(text);
}

function completion(content) {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content,
        },
      },
    ],
  };
}

test("OpenAI 兼容接口通过真实 HTTP 完成连接测试、分批筛选与鉴权失败", async (t) => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    if (
      request.method !== "POST" ||
      request.url !== "/v1/chat/completions"
    ) {
      sendJson(response, 404, { error: "not found" });
      return;
    }

    if (request.headers.authorization !== "Bearer integration-key") {
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }

    const body = await readJson(request);
    requests.push({
      authorization: request.headers.authorization,
      body,
      url: request.url,
    });
    const userContent = body.messages.findLast(
      (message) => message.role === "user",
    )?.content;

    if (userContent === "连接测试") {
      sendJson(
        response,
        200,
        completion([{ type: "text", text: "OK" }]),
      );
      return;
    }

    const payload = JSON.parse(userContent);
    const selectedIds = payload.currentBank.questions
      .filter((question) => question.number % 2 === 0)
      .map((question) => question.id);
    sendJson(
      response,
      200,
      completion(
        JSON.stringify({
          name: "安全题",
          questionIds: selectedIds,
          reason: "题号为偶数，模拟安全主题匹配。",
          confidence: 0.88,
        }),
      ),
    );
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseConfiguration = {
    apiBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "integration-key",
    model: "integration-model",
    timeoutMs: 5_000,
  };
  const client = createOpenAiCompatibleClient(baseConfiguration);

  const connection = await testAiConnection(client);
  assert.equal(connection.ok, true);

  const bank = createBank(211);
  const candidate = await generatePartitionCandidate(client, bank, {
    bankId: bank.id,
    intent: "筛选安全相关题目",
    summary: "筛选安全题",
    suggestedPartitionName: "安全题",
  });

  assert.equal(requests.length, 4);
  assert.deepEqual(
    requests.slice(1).map((entry) => {
      const payload = JSON.parse(entry.body.messages[1].content);
      return [
        payload.batch.index,
        payload.currentBank.questions.length,
      ];
    }),
    [
      [1, 90],
      [2, 90],
      [3, 31],
    ],
  );
  assert.ok(
    requests.every(
      (entry) =>
        entry.url === "/v1/chat/completions" &&
        entry.authorization === "Bearer integration-key" &&
        !("response_format" in entry.body),
    ),
  );
  assert.equal(
    requests[0].body.max_tokens,
    1_024,
    "连接测试必须给推理模型留下生成最终文本的额度",
  );
  assert.equal(candidate.questionIds.length, 105);
  assert.deepEqual(candidate.questionIds.slice(0, 3), [
    "integration-bank:q-2",
    "integration-bank:q-4",
    "integration-bank:q-6",
  ]);

  const unauthorizedClient = createOpenAiCompatibleClient({
    ...baseConfiguration,
    apiKey: "wrong-key",
  });
  await assert.rejects(
    unauthorizedClient.complete([{ role: "user", content: "测试鉴权" }]),
    (error) =>
      error instanceof AiClientError &&
      error.code === "authentication" &&
      !error.message.includes("wrong-key"),
  );
});
