import {
  BUILTIN_BANK_ID,
  type ImportedBankDraft,
  type QuizBank,
} from "./bank-types";
import { questionBank } from "./question-bank";

const BUILTIN_BANK_NAME = "QuizDeck 示例题库 / Demo";

export function getBuiltInBank(): QuizBank {
  return {
    schema: 1,
    id: BUILTIN_BANK_ID,
    name: BUILTIN_BANK_NAME,
    version: questionBank.version,
    builtIn: true,
    sourceFileName: "quizdeck-demo.json",
    sourceSheets: [questionBank.sourceSheet],
    importedAt: null,
    questions: questionBank.questions,
    categories: [
      {
        id: "demo-category-product",
        name: "软件使用 / Product",
        questionIds: ["demo-q-1", "demo-q-2", "demo-q-9", "demo-q-10"],
      },
      {
        id: "demo-category-security",
        name: "信息安全 / Security",
        questionIds: ["demo-q-3", "demo-q-5", "demo-q-12", "demo-q-15"],
      },
      {
        id: "demo-category-training",
        name: "培训与合规 / Training & compliance",
        questionIds: ["demo-q-4", "demo-q-6", "demo-q-11", "demo-q-13"],
      },
      {
        id: "demo-category-ai",
        name: "AI 分类 / AI classification",
        questionIds: ["demo-q-7", "demo-q-8", "demo-q-14", "demo-q-16"],
      },
    ],
    importIssues: questionBank.questions
      .filter((question) => question.sourceIssue)
      .map((question) => ({
        code: "source-issue",
        severity: "warning" as const,
        message: question.sourceIssue ?? "源文件题目结构异常",
        questionNumber: question.number,
        questionId: question.id,
      })),
  };
}

function createBankId() {
  const suffix =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `imported-${suffix}`;
}

export function createImportedBank(
  draft: ImportedBankDraft,
  requestedName: string,
): QuizBank {
  const bankId = createBankId();
  const idMap = new Map<string, string>();
  const questions = draft.questions.map((question, index) => {
    const nextId = `${bankId}:q-${index + 1}`;
    idMap.set(question.id, nextId);
    return {
      ...question,
      id: nextId,
      number: index + 1,
      options: question.options.map((option) => ({ ...option })),
      answerKeys: [...question.answerKeys],
    };
  });
  const categories = draft.categories
    .map((category, index) => ({
      id: `${bankId}:category-${index + 1}`,
      name: category.name,
      questionIds: category.questionIds
        .map((questionId) => idMap.get(questionId))
        .filter((questionId): questionId is string => Boolean(questionId)),
    }))
    .filter((category) => category.questionIds.length > 0);
  const importIssues = draft.importIssues.map((issue) => ({
    ...issue,
    questionId: issue.questionId
      ? idMap.get(issue.questionId)
      : undefined,
  }));
  const name = requestedName.trim() || draft.suggestedName;

  return {
    schema: 1,
    id: bankId,
    name,
    version: `imported-${Date.now()}-${questions.length}`,
    builtIn: false,
    sourceFileName: draft.sourceFileName,
    sourceSheets: [...draft.sourceSheets],
    importedAt: new Date().toISOString(),
    questions,
    categories,
    importIssues,
  };
}
