import assert from "node:assert/strict";
import test from "node:test";

import { BUILTIN_BANK_ID } from "../app/bank-types.ts";
import { isValidImportedBank } from "../app/bank-storage.ts";

function validQuestion(bankId, suffix = "1") {
  return {
    id: `${bankId}:q-${suffix}`,
    number: Number(suffix),
    sourceRow: Number(suffix) + 1,
    type: "single",
    stem: `示例题 ${suffix}`,
    options: [
      { id: "A", text: "正确项" },
      { id: "B", text: "干扰项" },
    ],
    answerKeys: ["A"],
    answerText: null,
    gradable: true,
    optionOrderLocked: false,
    sourceIssue: null,
  };
}

function validBank() {
  const id = "imported-valid";
  const question = validQuestion(id);
  return {
    schema: 1,
    id,
    name: "有效题库",
    version: "imported-v1",
    builtIn: false,
    sourceFileName: "有效题库.xlsx",
    sourceSheets: ["题库"],
    importedAt: "2026-07-25T12:00:00.000Z",
    questions: [question],
    categories: [
      {
        id: `${id}:category-1`,
        name: "第一章",
        questionIds: [question.id],
      },
    ],
    importIssues: [],
  };
}

test("accepts a fully valid imported bank record", () => {
  assert.equal(isValidImportedBank(validBank()), true);
});

test("rejects imported records that reuse the built-in bank id", () => {
  const value = validBank();
  value.id = BUILTIN_BANK_ID;
  assert.equal(isValidImportedBank(value), false);
});

test("rejects duplicate question ids", () => {
  const value = validBank();
  value.questions.push(structuredClone(value.questions[0]));
  assert.equal(isValidImportedBank(value), false);
});

test("rejects categories that reference another bank or missing question", () => {
  const value = validBank();
  value.categories[0].questionIds.push("imported-other:q-1");
  assert.equal(isValidImportedBank(value), false);
});

test("rejects invalid answer references on gradable questions", () => {
  const value = validBank();
  value.questions[0].answerKeys = ["Z"];
  assert.equal(isValidImportedBank(value), false);
});

test("allows a reported source anomaly only when the question is ungradable", () => {
  const value = validBank();
  value.questions[0].answerKeys = ["Z"];
  value.questions[0].gradable = false;
  value.questions[0].sourceIssue = "源题答案包含缺失选项：Z";
  value.importIssues = [
    {
      code: "answer-out-of-range",
      severity: "warning",
      message: "答案引用了不存在的选项",
      questionNumber: 1,
      questionId: value.questions[0].id,
    },
  ];
  assert.equal(isValidImportedBank(value), true);
});
