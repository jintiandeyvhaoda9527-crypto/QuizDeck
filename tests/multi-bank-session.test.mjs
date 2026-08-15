import assert from "node:assert/strict";
import test from "node:test";

import { getBuiltInBank } from "../app/bank-catalog.ts";
import { BUILTIN_BANK_ID } from "../app/bank-types.ts";
import { createAttempt } from "../app/quiz-core.ts";
import {
  LEGACY_ATTEMPT_STORAGE_KEY,
  SESSIONS_STORAGE_KEY,
  readStoredSessions,
  writeStoredSessions,
} from "../app/quiz-session-storage.ts";

function createLocalStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function question(id, answerKey) {
  return {
    id,
    number: 1,
    sourceRow: 2,
    type: "single",
    stem: "示例题目",
    options: [
      { id: "A", text: "甲" },
      { id: "B", text: "乙" },
    ],
    answerKeys: [answerKey],
    answerText: null,
    gradable: true,
    optionOrderLocked: false,
    sourceIssue: null,
  };
}

function bank(id, version, answerKey = "A") {
  return {
    schema: 1,
    id,
    name: id,
    version,
    builtIn: id === BUILTIN_BANK_ID,
    sourceFileName: `${id}.xls`,
    sourceSheets: ["题库"],
    importedAt: null,
    questions: [question("q-1", answerKey)],
    categories: [],
    importIssues: [],
  };
}

function sessionFor(targetBank, selectedId) {
  const questionIds = targetBank.questions.map((item) => item.id);
  const firstQuestionId = questionIds[0];
  const attempt = createAttempt(
    targetBank.questions,
    "practice",
    {
      shuffleQuestions: false,
      shuffleOptions: false,
      questionCount: targetBank.questions.length,
    },
    "stable-seed",
  );
  return {
    bankId: targetBank.id,
    bankVersion: targetBank.version,
    scope: {
      kind: "all",
      id: "all",
      name: "全部题目",
      questionIds,
    },
    attempt,
    answers: {
      [firstQuestionId]: { selectedIds: [selectedId], text: "" },
    },
    revealed: [firstQuestionId],
    cursor: 0,
    submitted: false,
    reviewIndex: 0,
  };
}

test("legacy built-in progress migrates without deleting the v1 key", () => {
  const localStorage = createLocalStorage();
  globalThis.window = { localStorage };
  const builtIn = getBuiltInBank();
  const firstQuestion = builtIn.questions[0];
  const legacy = {
    schema: 1,
    bankVersion: builtIn.version,
    mode: "practice",
    prefs: { shuffleQuestions: false, shuffleOptions: false },
    seed: "legacy-seed",
    answers: {
      [firstQuestion.id]: { selectedIds: ["A"], text: "" },
    },
    revealed: [firstQuestion.id],
    cursor: 0,
    submitted: false,
    reviewIndex: 0,
  };
  localStorage.setItem(
    LEGACY_ATTEMPT_STORAGE_KEY,
    JSON.stringify(legacy),
  );

  const sessions = readStoredSessions([builtIn]);
  assert.equal(sessions[BUILTIN_BANK_ID]?.attempt.seed, "legacy-seed");
  assert.deepEqual(
    sessions[BUILTIN_BANK_ID]?.answers[firstQuestion.id].selectedIds,
    ["A"],
  );

  writeStoredSessions(sessions);
  assert.notEqual(
    localStorage.getItem(LEGACY_ATTEMPT_STORAGE_KEY),
    null,
  );
  assert.equal(
    JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY)).schema,
    2,
  );
  assert.equal(
    "questionIds" in
      JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY)).sessions[
        BUILTIN_BANK_ID
      ],
    false,
  );
});

test("sessions remain isolated when different banks reuse question ids", () => {
  const localStorage = createLocalStorage();
  globalThis.window = { localStorage };
  const first = bank(BUILTIN_BANK_ID, "v1", "A");
  const second = bank("imported-second", "v2", "B");
  writeStoredSessions({
    [first.id]: sessionFor(first, "A"),
    [second.id]: sessionFor(second, "B"),
  });

  const restored = readStoredSessions([first, second]);
  assert.deepEqual(
    restored[first.id]?.answers["q-1"].selectedIds,
    ["A"],
  );
  assert.deepEqual(
    restored[second.id]?.answers["q-1"].selectedIds,
    ["B"],
  );
  assert.equal(restored[first.id]?.bankId, first.id);
  assert.equal(restored[second.id]?.bankId, second.id);
});

test("strict scope validation rejects duplicate question ids", () => {
  const localStorage = createLocalStorage();
  globalThis.window = { localStorage };
  const imported = bank("imported-second", "v2", "B");
  writeStoredSessions({
    [imported.id]: sessionFor(imported, "B"),
  });

  const collection = JSON.parse(
    localStorage.getItem(SESSIONS_STORAGE_KEY),
  );
  collection.sessions[imported.id].scope.questionIds.push("q-1");
  localStorage.setItem(
    SESSIONS_STORAGE_KEY,
    JSON.stringify(collection),
  );

  const restored = readStoredSessions([imported]);
  assert.equal(restored[imported.id], undefined);
});

test("writeV2Collection=false preserves the existing v2 collection", () => {
  const localStorage = createLocalStorage();
  globalThis.window = { localStorage };
  const builtIn = getBuiltInBank();
  const sentinel = JSON.stringify({
    schema: 2,
    sessions: { preserved: { value: true } },
  });
  localStorage.setItem(SESSIONS_STORAGE_KEY, sentinel);

  writeStoredSessions(
    {
      [BUILTIN_BANK_ID]: sessionFor(builtIn, "A"),
    },
    false,
  );

  assert.equal(localStorage.getItem(SESSIONS_STORAGE_KEY), sentinel);
  assert.notEqual(
    localStorage.getItem(LEGACY_ATTEMPT_STORAGE_KEY),
    null,
  );
});

test("scoped built-in sessions remove stale legacy progress", () => {
  const localStorage = createLocalStorage();
  globalThis.window = { localStorage };
  const builtIn = getBuiltInBank();
  const scoped = sessionFor(builtIn, "A");
  scoped.scope = {
    kind: "wrong",
    id: "wrong",
    name: "错题专项",
    questionIds: [builtIn.questions[0].id],
  };
  localStorage.setItem(
    LEGACY_ATTEMPT_STORAGE_KEY,
    JSON.stringify({ stale: true }),
  );

  writeStoredSessions({
    [BUILTIN_BANK_ID]: scoped,
  });

  assert.equal(
    localStorage.getItem(LEGACY_ATTEMPT_STORAGE_KEY),
    null,
  );
});
