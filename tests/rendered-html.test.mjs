import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname = "/", origin = "http://localhost") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: handler } = await import(workerUrl.href);

  return handler(
    new Request(`${origin}${pathname}`, {
      headers: {
        accept: "text/html",
        host: new URL(origin).host,
      },
    }),
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the QuizDeck home screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /<title>QuizDeck · AI 智能分类与离线答题<\/title>/i);
  assert.match(html, /离线优先 · 企业学习/);
  assert.match(html, /全部题库/);
  assert.match(html, /QuizDeck 示例题库/);
  assert.match(html, /开始练习/);
  assert.match(html, /16/);
  assert.match(html, /rel="manifest"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("keeps loopback metadata assets on HTTP during local development", async () => {
  const response = await render("/", "http://127.0.0.1:3000");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /http:\/\/127\.0\.0\.1:3000\/icons\/icon-192\.png/);
  assert.doesNotMatch(html, /https:\/\/127\.0\.0\.1:3000/);
});

test("ships the original neutral demo bank and required offline assets", async () => {
  const [page, layout, packageJson, manifest, bankText] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/questions.json", import.meta.url), "utf8"),
  ]);
  const bank = JSON.parse(bankText);

  assert.match(page, /<QuizApp \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /ServiceWorkerRegister/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.equal(bank.questionCount, 16);
  assert.equal(bank.gradableCount, 16);
  assert.equal(bank.questions.length, 16);
  assert.deepEqual(
    Object.fromEntries(
      ["single", "multiple", "judge", "fill"].map((type) => [
        type,
        bank.questions.filter((question) => question.type === type).length,
      ]),
    ),
    { single: 4, multiple: 4, judge: 4, fill: 4 },
  );
  assert.equal(bank.questions.every((question) => question.gradable), true);
  assert.equal(new Set(bank.questions.map((question) => question.id)).size, 16);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/icons/icon-192.png", import.meta.url));
  await access(new URL("../public/icons/icon-512.png", import.meta.url));
  await access(new URL("../public/sw.js", import.meta.url));
  await access(projectRoot);
});
