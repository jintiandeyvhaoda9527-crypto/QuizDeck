import {
  BUILTIN_BANK_ID,
  type ImportIssue,
  type QuizBank,
} from "./bank-types";
import type { Question, QuizOption } from "./quiz-core";

const DATABASE_NAME = "quizdeck-offline-banks";
const DATABASE_VERSION = 1;
const BANK_STORE = "banks";

export type BankStorageErrorCode =
  | "storage-unavailable"
  | "open-failed"
  | "load-failed"
  | "built-in-save"
  | "invalid-imported-bank"
  | "save-failed"
  | "empty-bank-id"
  | "built-in-delete"
  | "delete-failed";

export class BankStorageError extends Error {
  override readonly name = "BankStorageError";

  constructor(readonly code: BankStorageErrorCode) {
    super(code);
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new BankStorageError("storage-unavailable"));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.open(
        DATABASE_NAME,
        DATABASE_VERSION,
      );
    } catch {
      reject(new BankStorageError("open-failed"));
      return;
    }
    request.onerror = () => {
      reject(new BankStorageError("open-failed"));
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BANK_STORE)) {
        database.createObjectStore(BANK_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isQuizOption(value: unknown): value is QuizOption {
  if (!value || typeof value !== "object") {
    return false;
  }

  const option = value as Partial<QuizOption>;
  return isNonEmptyString(option.id) && isNonEmptyString(option.text);
}

function isQuestion(
  value: unknown,
  bankId: string,
  seenQuestionIds: Set<string>,
): value is Question {
  if (!value || typeof value !== "object") {
    return false;
  }

  const question = value as Partial<Question>;
  if (
    !isNonEmptyString(question.id) ||
    !question.id.startsWith(`${bankId}:`) ||
    seenQuestionIds.has(question.id) ||
    !Number.isInteger(question.number) ||
    (question.number ?? 0) < 1 ||
    !Number.isInteger(question.sourceRow) ||
    (question.sourceRow ?? 0) < 1 ||
    (question.type !== "single" &&
      question.type !== "multiple" &&
      question.type !== "judge" &&
      question.type !== "fill") ||
    !isNonEmptyString(question.stem) ||
    !Array.isArray(question.options) ||
    !question.options.every(isQuizOption) ||
    !Array.isArray(question.answerKeys) ||
    !question.answerKeys.every(isNonEmptyString) ||
    (question.answerText !== null &&
      typeof question.answerText !== "string") ||
    typeof question.gradable !== "boolean" ||
    typeof question.optionOrderLocked !== "boolean" ||
    (question.sourceIssue !== null &&
      typeof question.sourceIssue !== "string")
  ) {
    return false;
  }

  const optionIds = question.options.map((option) => option.id);
  const answerKeys = question.answerKeys;
  if (
    new Set(optionIds).size !== optionIds.length ||
    new Set(answerKeys).size !== answerKeys.length
  ) {
    return false;
  }

  if (
    question.gradable &&
    question.type !== "fill" &&
    answerKeys.some((answerKey) => !optionIds.includes(answerKey))
  ) {
    return false;
  }

  seenQuestionIds.add(question.id);
  return true;
}

function isImportIssue(
  value: unknown,
  questionIds: ReadonlySet<string>,
): value is ImportIssue {
  if (!value || typeof value !== "object") {
    return false;
  }

  const issue = value as Partial<ImportIssue>;
  return (
    isNonEmptyString(issue.code) &&
    (issue.severity === "warning" || issue.severity === "error") &&
    isNonEmptyString(issue.message) &&
    (issue.questionNumber === undefined ||
      (Number.isInteger(issue.questionNumber) &&
        issue.questionNumber >= 1)) &&
    (issue.questionId === undefined ||
      (isNonEmptyString(issue.questionId) &&
        questionIds.has(issue.questionId)))
  );
}

export function isValidImportedBank(value: unknown): value is QuizBank {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bank = value as Partial<QuizBank>;
  if (
    bank.schema === 1 &&
    isNonEmptyString(bank.id) &&
    bank.id !== BUILTIN_BANK_ID &&
    isNonEmptyString(bank.name) &&
    isNonEmptyString(bank.version) &&
    bank.builtIn === false &&
    isNonEmptyString(bank.sourceFileName) &&
    Array.isArray(bank.sourceSheets) &&
    bank.sourceSheets.length > 0 &&
    bank.sourceSheets.every(isNonEmptyString) &&
    typeof bank.importedAt === "string" &&
    !Number.isNaN(Date.parse(bank.importedAt)) &&
    Array.isArray(bank.questions) &&
    bank.questions.length > 0 &&
    Array.isArray(bank.categories) &&
    Array.isArray(bank.importIssues)
  ) {
    const seenQuestionIds = new Set<string>();
    if (
      !bank.questions.every((question) =>
        isQuestion(question, bank.id as string, seenQuestionIds),
      )
    ) {
      return false;
    }

    const seenCategoryIds = new Set<string>();
    for (const category of bank.categories) {
      if (!category || typeof category !== "object") {
        return false;
      }

      const categoryId = category.id;
      if (
        !isNonEmptyString(categoryId) ||
        seenCategoryIds.has(categoryId) ||
        !isNonEmptyString(category.name) ||
        !Array.isArray(category.questionIds) ||
        category.questionIds.length === 0 ||
        !category.questionIds.every(
          (questionId): questionId is string =>
            isNonEmptyString(questionId) &&
            seenQuestionIds.has(questionId),
        ) ||
        new Set(category.questionIds).size !== category.questionIds.length
      ) {
        return false;
      }
      seenCategoryIds.add(categoryId);
    }

    return bank.importIssues.every((issue) =>
      isImportIssue(issue, seenQuestionIds),
    );
  }

  return false;
}

export async function loadImportedBanks() {
  const database = await openDatabase();

  try {
    return await new Promise<QuizBank[]>((resolve, reject) => {
      try {
        const transaction = database.transaction(BANK_STORE, "readonly");
        const request = transaction.objectStore(BANK_STORE).getAll();
        request.onerror = () => {
          reject(new BankStorageError("load-failed"));
        };
        request.onsuccess = () => {
          resolve(
            (request.result as unknown[])
              .filter(isValidImportedBank)
              .sort((left, right) =>
                (left.importedAt ?? "").localeCompare(right.importedAt ?? ""),
              ),
          );
        };
      } catch {
        reject(new BankStorageError("load-failed"));
      }
    });
  } finally {
    database.close();
  }
}

export async function saveImportedBank(bank: QuizBank) {
  const isBuiltInBank =
    bank.id === BUILTIN_BANK_ID || bank.builtIn;
  if (!isValidImportedBank(bank)) {
    throw new BankStorageError(
      isBuiltInBank ? "built-in-save" : "invalid-imported-bank",
    );
  }

  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = database.transaction(BANK_STORE, "readwrite");
        transaction.onerror = () => {
          reject(new BankStorageError("save-failed"));
        };
        transaction.oncomplete = () => resolve();
        transaction.objectStore(BANK_STORE).put(bank);
      } catch {
        reject(new BankStorageError("save-failed"));
      }
    });
  } finally {
    database.close();
  }
}

export async function deleteImportedBank(bankId: string) {
  const normalizedBankId = bankId.trim();
  if (!normalizedBankId) {
    throw new BankStorageError("empty-bank-id");
  }
  if (normalizedBankId === BUILTIN_BANK_ID) {
    throw new BankStorageError("built-in-delete");
  }

  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = database.transaction(BANK_STORE, "readwrite");
        transaction.onerror = () => {
          reject(new BankStorageError("delete-failed"));
        };
        transaction.oncomplete = () => resolve();
        transaction.objectStore(BANK_STORE).delete(normalizedBankId);
      } catch {
        reject(new BankStorageError("delete-failed"));
      }
    });
  } finally {
    database.close();
  }
}
