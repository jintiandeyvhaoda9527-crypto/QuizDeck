import type { Question } from "./quiz-core";

export const BUILTIN_BANK_ID = "builtin-quizdeck-demo";

export interface FileCategory {
  id: string;
  name: string;
  questionIds: string[];
}

export interface ImportIssue {
  code: string;
  severity: "warning" | "error";
  message: string;
  questionNumber?: number;
  questionId?: string;
}

export interface QuizBank {
  schema: 1;
  id: string;
  name: string;
  version: string;
  builtIn: boolean;
  sourceFileName: string;
  sourceSheets: string[];
  importedAt: string | null;
  questions: Question[];
  categories: FileCategory[];
  importIssues: ImportIssue[];
}

export interface ImportedBankDraft {
  suggestedName: string;
  sourceFileName: string;
  sourceSheets: string[];
  questions: Question[];
  categories: FileCategory[];
  importIssues: ImportIssue[];
}

export interface CustomPartition {
  id: string;
  name: string;
  questionIds: string[];
  createdAt: string;
}

export interface BankUserState {
  partitions: CustomPartition[];
  wrongQuestionIds: string[];
}

export interface QuestionScope {
  kind: "all" | "category" | "partition" | "wrong";
  id: string;
  name: string;
  questionIds: string[];
}

export const EMPTY_BANK_USER_STATE: BankUserState = {
  partitions: [],
  wrongQuestionIds: [],
};

export function getBankCounts(bank: QuizBank) {
  return {
    questionCount: bank.questions.length,
    gradableCount: bank.questions.filter((question) => question.gradable).length,
    typeCounts: {
      single: bank.questions.filter((question) => question.type === "single").length,
      multiple: bank.questions.filter((question) => question.type === "multiple").length,
      judge: bank.questions.filter((question) => question.type === "judge").length,
      fill: bank.questions.filter((question) => question.type === "fill").length,
    },
  };
}

export function selectScopeQuestions(
  bank: QuizBank,
  questionIds: readonly string[],
) {
  const allowed = new Set(questionIds);
  return bank.questions.filter((question) => allowed.has(question.id));
}
