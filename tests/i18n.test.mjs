import assert from "node:assert/strict";
import test from "node:test";

import { baseMessages } from "../app/i18n/base-messages.ts";
import { coreMessages } from "../app/i18n/core-messages.ts";
import { translate } from "../app/i18n/index.tsx";
import { libraryMessages } from "../app/i18n/library-messages.ts";
import { quizMessages } from "../app/i18n/quiz-messages.ts";

test("every public message catalog has matching Chinese and English keys", () => {
  for (const catalog of [
    baseMessages,
    coreMessages,
    libraryMessages,
    quizMessages,
  ]) {
    assert.deepEqual(
      Object.keys(catalog["en-US"]).sort(),
      Object.keys(catalog["zh-CN"]).sort(),
    );
    assert.ok(
      Object.values(catalog["en-US"]).every(
        (message) => typeof message === "string" && message.trim().length > 0,
      ),
    );
  }
});

test("translation applies localized templates and named values", () => {
  assert.equal(
    translate("en-US", "app.title"),
    "QuizDeck · AI-assisted offline learning",
  );
  assert.equal(
    translate("en-US", "library.count.bank.other", { count: 3 }),
    "3 banks",
  );
  assert.equal(
    translate("zh-CN", "library.count.bank.other", { count: 3 }),
    "3 个",
  );
});
