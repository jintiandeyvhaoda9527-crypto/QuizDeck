import {
  BUILTIN_BANK_ID,
  type ImportedBankDraft,
  type ImportIssue,
  type QuizBank,
} from "./bank-types";

type BankContent = Pick<QuizBank, "questions" | "categories">;

export interface ImportIssueDetail extends ImportIssue {
  questionStem?: string;
}

function canonicalBankContent(source: BankContent) {
  const questionIndexes = new Map(
    source.questions.map((question, index) => [question.id, index]),
  );

  return JSON.stringify({
    questions: source.questions.map((question) => ({
      number: question.number,
      sourceRow: question.sourceRow,
      type: question.type,
      stem: question.stem,
      options: question.options.map((option) => [option.id, option.text]),
      answerKeys: question.answerKeys,
      answerText: question.answerText,
      gradable: question.gradable,
      optionOrderLocked: question.optionOrderLocked,
      sourceIssue: question.sourceIssue,
    })),
    categories: source.categories.map((category) => ({
      name: category.name,
      questionIndexes: category.questionIds.map(
        (questionId) => questionIndexes.get(questionId) ?? -1,
      ),
    })),
  });
}

function hashText(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(
    second >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

export function createQuestionBankFingerprint(source: BankContent) {
  return `question-bank-v1:${hashText(canonicalBankContent(source))}`;
}

export function findDuplicateQuestionBank(
  draft: Pick<ImportedBankDraft, "questions" | "categories">,
  banks: readonly QuizBank[],
) {
  const draftContent = canonicalBankContent(draft);
  const draftFingerprint = hashText(draftContent);

  return (
    banks.find((bank) => {
      const bankContent = canonicalBankContent(bank);
      return (
        hashText(bankContent) === draftFingerprint &&
        bankContent === draftContent
      );
    }) ?? null
  );
}

export function renameImportedBank(
  bank: QuizBank,
  requestedName: string,
): QuizBank {
  if (bank.builtIn || bank.id === BUILTIN_BANK_ID) {
    throw new Error("内置题库不能重命名");
  }

  const name = requestedName.trim();
  if (!name) {
    throw new Error("题库名称不能为空");
  }

  if (name === bank.name) {
    return bank;
  }

  return {
    ...bank,
    name,
  };
}

export function getImportIssueDetails(
  bank: QuizBank,
  severity?: ImportIssue["severity"],
): ImportIssueDetail[] {
  const questionsById = new Map(
    bank.questions.map((question) => [question.id, question]),
  );

  return bank.importIssues
    .filter((issue) => !severity || issue.severity === severity)
    .map((issue) => ({
      ...issue,
      questionStem: issue.questionId
        ? questionsById.get(issue.questionId)?.stem
        : undefined,
    }));
}

export function removeBankScopedEntry<T>(
  records: Readonly<Record<string, T | undefined>>,
  bankId: string,
): Record<string, T | undefined> {
  if (!(bankId in records)) {
    return records as Record<string, T | undefined>;
  }

  const next = { ...records };
  delete next[bankId];
  return next;
}
