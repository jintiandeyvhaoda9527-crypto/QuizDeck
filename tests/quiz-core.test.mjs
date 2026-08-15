import assert from "node:assert/strict";
import test from "node:test";

import {
  createAttempt,
  createSeededRandom,
  gradeQuestion,
  normalizeFillAnswer,
  orderOptions,
  scoreAttempt,
  shuffle,
} from "../app/quiz-core.ts";

function question(overrides = {}) {
  return {
    id: "q-1",
    number: 1,
    sourceRow: 2,
    type: "multiple",
    stem: "示例",
    options: [
      { id: "A", text: "甲" },
      { id: "B", text: "乙" },
      { id: "C", text: "丙" },
      { id: "D", text: "丁" },
    ],
    answerKeys: ["A", "C"],
    answerText: null,
    gradable: true,
    optionOrderLocked: false,
    sourceIssue: null,
    ...overrides,
  };
}

test("seeded random and Fisher-Yates shuffle are stable and non-mutating", () => {
  const source = ["A", "B", "C", "D", "E", "F"];
  const first = shuffle(source, createSeededRandom("same-seed"));
  const second = shuffle(source, createSeededRandom("same-seed"));
  const third = shuffle(source, createSeededRandom("other-seed"));

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, third);
  assert.deepEqual(source, ["A", "B", "C", "D", "E", "F"]);
  assert.notStrictEqual(first, source);
});

test("option order remains locked for judge questions", () => {
  const locked = question({
    type: "judge",
    optionOrderLocked: true,
    options: [
      { id: "A", text: "正确" },
      { id: "B", text: "错误" },
    ],
    answerKeys: ["A"],
  });

  const ordered = orderOptions(locked, true, "try-to-shuffle");
  assert.deepEqual(
    ordered.map((option) => option.id),
    ["A", "B"],
  );
  assert.notStrictEqual(ordered, locked.options);
  assert.notStrictEqual(ordered[0], locked.options[0]);
});

test("choice grading uses exact set equality", () => {
  const multiple = question();
  const single = question({ type: "single", answerKeys: ["B"] });
  const judge = question({ type: "judge", answerKeys: ["A"] });

  assert.equal(gradeQuestion(multiple, ["C", "A"]).correct, true);
  assert.equal(gradeQuestion(multiple, ["A"]).correct, false);
  assert.equal(gradeQuestion(multiple, ["A", "B", "C"]).correct, false);
  assert.equal(gradeQuestion(single, ["B"]).correct, true);
  assert.equal(gradeQuestion(single, ["A", "B"]).correct, false);
  assert.equal(gradeQuestion(judge, ["A"]).correct, true);
});

test("fill grading normalizes Chinese punctuation and whitespace", () => {
  const fill = question({
    type: "fill",
    options: [],
    answerKeys: [],
    answerText: "不隔夜，不隔班；不隔周",
  });

  assert.equal(normalizeFillAnswer(" 不隔夜, 不隔班； 不隔周。 "), "不隔夜不隔班不隔周");
  assert.equal(gradeQuestion(fill, [], "不隔夜 不隔班、不隔周").correct, true);
  assert.equal(gradeQuestion(fill, [], "不隔夜、不隔周、不隔班").correct, false);
});

test("attempt creation locks stable display order without mutating the bank", () => {
  const questions = [
    question({ id: "q-1", number: 1 }),
    question({ id: "q-2", number: 2 }),
    question({ id: "q-3", number: 3, optionOrderLocked: true }),
    question({ id: "q-4", number: 4 }),
  ];
  const original = structuredClone(questions);
  const preferences = {
    shuffleQuestions: true,
    shuffleOptions: true,
    questionCount: 3,
  };
  const first = createAttempt(questions, "exam", preferences, 424242);
  const second = createAttempt(questions, "exam", preferences, 424242);

  assert.deepEqual(first, second);
  assert.equal(first.questions.length, 3);
  assert.deepEqual(questions, original);
  assert.notStrictEqual(first.questions[0], questions[0]);

  const locked = first.questions.find((item) => item.id === "q-3");
  if (locked) {
    assert.deepEqual(
      locked.options.map((option) => option.id),
      ["A", "B", "C", "D"],
    );
  }
});

test("score excludes gradable=false questions from its denominator", () => {
  const attempt = createAttempt(
    [
      question({ id: "correct", type: "single", answerKeys: ["A"] }),
      question({ id: "wrong", type: "single", answerKeys: ["B"] }),
      question({ id: "blank", type: "fill", options: [], answerKeys: [], answerText: "答案" }),
      question({ id: "source-issue", gradable: false, answerKeys: ["E"] }),
    ],
    "exam",
  );
  const score = scoreAttempt(attempt, {
    correct: { selectedIds: ["A"], text: "" },
    wrong: { selectedIds: ["A"], text: "" },
    "source-issue": { selectedIds: ["A"], text: "" },
  });

  assert.deepEqual(score, {
    total: 3,
    gradableTotal: 3,
    answered: 2,
    correct: 1,
    incorrect: 1,
    unanswered: 1,
    excluded: 1,
    percentage: 33.3,
  });
  assert.equal(
    gradeQuestion(attempt.questions[3], ["A"]).correct,
    null,
  );
});
