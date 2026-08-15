import rawBank from "./data/questions.json";
import type { QuestionBank } from "./quiz-core";

const supportedTypes = new Set(["single", "multiple", "judge", "fill"]);

function validateQuestionBank(value: unknown): asserts value is QuestionBank {
  if (!value || typeof value !== "object") {
    throw new Error("题库数据无效");
  }

  const bank = value as Partial<QuestionBank>;
  if (
    typeof bank.version !== "string" ||
    !Array.isArray(bank.questions) ||
    bank.questions.length !== bank.questionCount
  ) {
    throw new Error("题库元数据不完整");
  }

  const seenIds = new Set<string>();
  for (const question of bank.questions) {
    if (
      typeof question.id !== "string" ||
      seenIds.has(question.id) ||
      typeof question.stem !== "string" ||
      !supportedTypes.has(question.type) ||
      !Array.isArray(question.options) ||
      !Array.isArray(question.answerKeys)
    ) {
      throw new Error("题库题目结构无效");
    }

    seenIds.add(question.id);
    const optionIds = new Set(question.options.map((option) => option.id));
    if (
      question.gradable &&
      question.type !== "fill" &&
      question.answerKeys.some((key) => !optionIds.has(key))
    ) {
      throw new Error(`题目 ${question.number} 的答案与选项不一致`);
    }
  }
}

validateQuestionBank(rawBank);

export const questionBank = rawBank;
