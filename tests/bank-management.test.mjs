import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuestionBankFingerprint,
  findDuplicateQuestionBank,
  getImportIssueDetails,
  removeBankScopedEntry,
  renameImportedBank,
} from "../app/bank-management.ts";
import { deleteImportedBank } from "../app/bank-storage.ts";
import { BUILTIN_BANK_ID } from "../app/bank-types.ts";
import { getLibraryErrorMessage } from "../app/i18n/library-messages.ts";
import {
  createCustomPartition,
  deleteCustomPartition,
  removeBankUserState,
  updateCustomPartition,
} from "../app/bank-user-state.ts";

function question(id, number, overrides = {}) {
  return {
    id,
    number,
    sourceRow: number + 1,
    type: "single",
    stem: `示例题 ${number}`,
    options: [
      { id: "A", text: "正确项" },
      { id: "B", text: "干扰项" },
    ],
    answerKeys: ["A"],
    answerText: null,
    gradable: true,
    optionOrderLocked: false,
    sourceIssue: null,
    ...overrides,
  };
}

function bank(id = "imported-first", overrides = {}) {
  const questions = [question(`${id}:q-1`, 1), question(`${id}:q-2`, 2)];
  return {
    schema: 1,
    id,
    name: "示例题库",
    version: "imported-v1",
    builtIn: false,
    sourceFileName: "示例.xlsx",
    sourceSheets: ["题库"],
    importedAt: "2026-07-25T12:00:00.000Z",
    questions,
    categories: [
      {
        id: `${id}:category-1`,
        name: "第一章",
        questionIds: questions.map((item) => item.id),
      },
    ],
    importIssues: [
      {
        code: "source-warning",
        severity: "warning",
        message: "原题存在异常",
        questionNumber: 2,
        questionId: questions[1].id,
      },
      {
        code: "file-warning",
        severity: "error",
        message: "文件级异常",
      },
    ],
    ...overrides,
  };
}

function draftWithRemappedIds(sourceBank) {
  const idMap = new Map(
    sourceBank.questions.map((item, index) => [
      item.id,
      `draft-question-${index + 1}`,
    ]),
  );
  return {
    suggestedName: "重新命名也应识别",
    sourceFileName: "副本.xlsx",
    sourceSheets: ["另一个表名"],
    questions: sourceBank.questions.map((item) => ({
      ...structuredClone(item),
      id: idMap.get(item.id),
    })),
    categories: sourceBank.categories.map((category, index) => ({
      id: `draft-category-${index + 1}`,
      name: category.name,
      questionIds: category.questionIds.map((id) => idMap.get(id)),
    })),
    importIssues: [],
  };
}

test("renames only imported banks and preserves progress-sensitive version", () => {
  const original = bank();
  const renamed = renameImportedBank(original, "  新名称  ");

  assert.equal(renamed.name, "新名称");
  assert.equal(renamed.version, original.version);
  assert.equal(original.name, "示例题库");
  assert.notEqual(renamed, original);

  assert.throws(
    () => renameImportedBank({ ...original, builtIn: true }, "不能修改"),
    (error) => {
      assert.equal(error.name, "BankManagementError");
      assert.equal(error.code, "built-in-rename");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "The built-in question bank cannot be renamed.",
      );
      return true;
    },
  );
  assert.throws(
    () => renameImportedBank(original, "   "),
    (error) => {
      assert.equal(error.name, "BankManagementError");
      assert.equal(error.code, "empty-bank-name");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "The question-bank name cannot be empty.",
      );
      return true;
    },
  );
});

test("detects the same question bank independently of generated ids and names", () => {
  const existing = bank();
  const draft = draftWithRemappedIds(existing);

  assert.equal(
    createQuestionBankFingerprint(existing),
    createQuestionBankFingerprint(draft),
  );
  assert.equal(
    findDuplicateQuestionBank(draft, [existing])?.id,
    existing.id,
  );

  draft.questions[0].stem = "内容确实发生变化";
  assert.equal(findDuplicateQuestionBank(draft, [existing]), null);
});

test("returns concrete import issue details and supports severity filtering", () => {
  const source = bank();
  const details = getImportIssueDetails(source);

  assert.equal(details.length, 2);
  assert.equal(details[0].questionStem, "示例题 2");
  assert.equal(details[1].questionStem, undefined);
  assert.deepEqual(
    getImportIssueDetails(source, "error").map((issue) => issue.code),
    ["file-warning"],
  );
  assert.notEqual(details[0], source.importIssues[0]);
});

test("removes one bank-scoped record without mutating neighboring records", () => {
  const records = {
    first: { value: 1 },
    second: { value: 2 },
  };
  const next = removeBankScopedEntry(records, "first");

  assert.deepEqual(next, { second: { value: 2 } });
  assert.deepEqual(records, {
    first: { value: 1 },
    second: { value: 2 },
  });
  assert.equal(removeBankScopedEntry(records, "missing"), records);
});

test("creates, updates, and deletes partitions as immutable bank references", () => {
  const source = bank();
  const originalState = {
    partitions: [],
    wrongQuestionIds: [source.questions[1].id],
  };
  const created = createCustomPartition(originalState, source, {
    id: "partition-1",
    name: "  重点题  ",
    questionIds: [
      source.questions[1].id,
      "another-bank:q-1",
      source.questions[0].id,
      source.questions[1].id,
    ],
    createdAt: "2026-07-26T01:00:00.000Z",
  });

  assert.equal(originalState.partitions.length, 0);
  assert.deepEqual(created.partitions[0], {
    id: "partition-1",
    name: "重点题",
    questionIds: source.questions.map((item) => item.id),
    createdAt: "2026-07-26T01:00:00.000Z",
  });
  assert.deepEqual(
    created.wrongQuestionIds,
    originalState.wrongQuestionIds,
  );

  const updated = updateCustomPartition(
    created,
    source,
    "partition-1",
    {
      name: "  只练第二题 ",
      questionIds: [source.questions[1].id],
    },
  );
  assert.equal(updated.partitions[0].name, "只练第二题");
  assert.deepEqual(updated.partitions[0].questionIds, [
    source.questions[1].id,
  ]);
  assert.equal(
    updated.partitions[0].createdAt,
    created.partitions[0].createdAt,
  );
  assert.equal(created.partitions[0].name, "重点题");

  const deleted = deleteCustomPartition(updated, "partition-1");
  assert.deepEqual(deleted.partitions, []);
  assert.deepEqual(deleted.wrongQuestionIds, originalState.wrongQuestionIds);
  assert.equal(deleteCustomPartition(deleted, "missing"), deleted);
});

test("partition validation rejects empty or unrelated selections", () => {
  const source = bank();
  const state = { partitions: [], wrongQuestionIds: [] };
  const base = {
    id: "partition-1",
    createdAt: "2026-07-26T01:00:00.000Z",
  };

  assert.throws(
    () =>
      createCustomPartition(state, source, {
        ...base,
        name: " ",
        questionIds: [source.questions[0].id],
      }),
    (error) => {
      assert.equal(error.name, "BankUserStateError");
      assert.equal(error.code, "empty-partition-name");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "The partition name cannot be empty.",
      );
      return true;
    },
  );
  assert.throws(
    () =>
      createCustomPartition(state, source, {
        ...base,
        name: "其他题库",
        questionIds: ["another-bank:q-1"],
      }),
    (error) => {
      assert.equal(error.name, "BankUserStateError");
      assert.equal(error.code, "empty-partition-selection");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "A partition must contain at least one valid question.",
      );
      return true;
    },
  );
  assert.throws(
    () =>
      updateCustomPartition(state, source, "missing", {
        name: "不存在",
        questionIds: [source.questions[0].id],
      }),
    (error) => {
      assert.equal(error.name, "BankUserStateError");
      assert.equal(error.code, "partition-not-found");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "The partition to update was not found.",
      );
      return true;
    },
  );
});

test("removes only the selected bank user state", () => {
  const states = {
    first: { partitions: [], wrongQuestionIds: ["first:q-1"] },
    second: { partitions: [], wrongQuestionIds: ["second:q-1"] },
  };
  const next = removeBankUserState(states, "first");

  assert.equal(next.first, undefined);
  assert.deepEqual(next.second, states.second);
  assert.equal(removeBankUserState(states, "missing"), states);
});

test("refuses built-in deletion before opening IndexedDB", async () => {
  await assert.rejects(
    deleteImportedBank(BUILTIN_BANK_ID),
    (error) => {
      assert.equal(error.name, "BankStorageError");
      assert.equal(error.code, "built-in-delete");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "The built-in question bank cannot be deleted.",
      );
      return true;
    },
  );
});

test("deletes exactly one imported bank record from IndexedDB", async () => {
  const previousIndexedDb = globalThis.indexedDB;
  let deletedKey = null;
  let databaseClosed = false;

  const database = {
    objectStoreNames: { contains: () => true },
    transaction() {
      const transaction = {
        error: null,
        onerror: null,
        oncomplete: null,
        objectStore() {
          return {
            delete(key) {
              deletedKey = key;
              queueMicrotask(() => transaction.oncomplete?.());
              return {};
            },
          };
        },
      };
      return transaction;
    },
    close() {
      databaseClosed = true;
    },
  };

  globalThis.indexedDB = {
    open() {
      const request = {
        result: database,
        error: null,
        onerror: null,
        onupgradeneeded: null,
        onsuccess: null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };

  try {
    await deleteImportedBank("  imported-first  ");
    assert.equal(deletedKey, "imported-first");
    assert.equal(databaseClosed, true);
  } finally {
    globalThis.indexedDB = previousIndexedDb;
  }
});
