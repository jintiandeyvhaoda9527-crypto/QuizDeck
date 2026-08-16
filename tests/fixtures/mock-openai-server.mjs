import http from "node:http";

const HOST = "127.0.0.1";
const PORT = Number(process.env.MOCK_AI_PORT ?? 4111);
const EXPECTED_KEY = "qa-local-key";
const stats = {
  requests: 0,
  modelLists: 0,
  connectionTests: 0,
  partitionBatches: [],
};

function writeJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 2_000_000) {
      throw new Error("request too large");
    }
  }
  return JSON.parse(text);
}

function completion(content) {
  return {
    id: `chatcmpl-qa-${stats.requests}`,
    object: "chat.completion",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content,
        },
      },
    ],
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    writeJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/stats") {
    writeJson(response, 200, stats);
    return;
  }

  if (request.method === "GET" && request.url === "/v1/models") {
    if (request.headers.authorization !== `Bearer ${EXPECTED_KEY}`) {
      writeJson(response, 401, { error: "unauthorized" });
      return;
    }
    stats.modelLists += 1;
    writeJson(response, 200, {
      object: "list",
      data: [
        {
          id: "qa-chat-model",
          object: "model",
          owned_by: "quizdeck-local-fixture",
        },
      ],
    });
    return;
  }

  if (
    request.method !== "POST" ||
    request.url !== "/v1/chat/completions"
  ) {
    writeJson(response, 404, { error: "not found" });
    return;
  }

  if (request.headers.authorization !== `Bearer ${EXPECTED_KEY}`) {
    writeJson(response, 401, { error: "unauthorized" });
    return;
  }

  try {
    stats.requests += 1;
    const body = await readJson(request);
    const userMessage = body.messages?.findLast(
      (message) => message.role === "user",
    )?.content;

    if (userMessage === "连接测试") {
      stats.connectionTests += 1;
      writeJson(response, 200, completion("OK"));
      return;
    }

    const payload = JSON.parse(userMessage);
    const questions = payload.currentBank?.questions;
    if (!Array.isArray(questions) || !payload.confirmedRequest) {
      writeJson(response, 400, { error: "invalid partition payload" });
      return;
    }

    stats.partitionBatches.push({
      index: payload.batch?.index,
      total: payload.batch?.total,
      questionCount: questions.length,
    });

    const matched = questions
      .filter((question) =>
        /安全|消防|火灾|故障|应急/u.test(
          `${question.stem} ${question.options
            ?.map((option) => option.text)
            .join(" ")}`,
        ),
      )
      .map((question) => question.id);

    writeJson(
      response,
      200,
      completion(
        JSON.stringify({
          name: "安全与应急",
          questionIds: matched,
          reason: "题干或选项涉及安全、消防、故障或应急处置。",
          confidence: 0.9,
        }),
      ),
    );
  } catch {
    writeJson(response, 400, { error: "bad request" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mock OpenAI server listening at http://${HOST}:${PORT}`);
});
