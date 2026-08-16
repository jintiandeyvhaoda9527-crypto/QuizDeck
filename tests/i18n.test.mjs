import assert from "node:assert/strict";
import test from "node:test";

import { baseMessages } from "../app/i18n/base-messages.ts";
import { coreMessages } from "../app/i18n/core-messages.ts";
import { translate } from "../app/i18n/index.tsx";
import {
  getLibraryErrorMessage,
  libraryMessages,
} from "../app/i18n/library-messages.ts";
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

test("library error mapping localizes typed errors without exposing raw messages", () => {
  const error = {
    name: "QuestionBankImportError",
    code: "too-many-rows",
    params: { maxRows: 20_000 },
    message: "raw diagnostic that must not reach the interface",
  };

  assert.equal(
    getLibraryErrorMessage("en-US", error),
    "A question-bank file can contain at most 20000 rows.",
  );
  assert.equal(
    getLibraryErrorMessage("zh-CN", error),
    "题库文件最多支持 20000 行。",
  );
  assert.equal(
    getLibraryErrorMessage("en-US", new Error("raw storage failure")),
    null,
  );
});
