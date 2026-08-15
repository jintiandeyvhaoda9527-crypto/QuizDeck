export type QuestionType = "single" | "multiple" | "judge" | "fill";

export interface QuizOption {
  id: string;
  text: string;
}

/** The shape stored in app/data/questions.json. */
export interface Question {
  id: string;
  number: number;
  sourceRow: number;
  type: QuestionType;
  stem: string;
  options: QuizOption[];
  answerKeys: string[];
  answerText: string | null;
  gradable: boolean;
  optionOrderLocked: boolean;
  sourceIssue: string | null;
}

export interface QuestionBank {
  version: string;
  sourceSheet: string;
  questionCount: number;
  gradableCount: number;
  questions: Question[];
}

export type QuizMode = "practice" | "exam";
export type Seed = string | number;
export type RandomSource = () => number;

export interface AttemptPreferences {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  questionCount?: number;
}

export interface ResolvedAttemptPreferences {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionCount: number;
}

export type AttemptQuestion = Question;

export interface Attempt {
  mode: QuizMode;
  prefs: ResolvedAttemptPreferences;
  seed: Seed;
  questions: AttemptQuestion[];
}

export interface AttemptAnswer {
  selectedIds: string[];
  text: string;
}

export type AttemptAnswers = Readonly<
  Record<string, AttemptAnswer | undefined>
>;

export interface GradeResult {
  questionId: string;
  gradable: boolean;
  answered: boolean;
  correct: boolean | null;
  selectedIds: string[];
  text: string;
  correctIds: string[];
  correctText: string | null;
}

export interface ScoreSummary {
  /** Number of gradable questions; this is the scoring denominator. */
  total: number;
  gradableTotal: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** Questions marked gradable=false and therefore omitted from the score. */
  excluded: number;
  /** Percentage from 0 to 100, rounded to one decimal place. */
  percentage: number;
}

export const DEFAULT_ATTEMPT_SEED = "quizdeck";

function hashSeed(seed: Seed): number {
  const value = String(seed);
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Returns a deterministic pseudo-random source in the same 0 <= n < 1 range as
 * Math.random. Each call creates an independent stream.
 */
export function createSeededRandom(seed: Seed): RandomSource {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/** A non-mutating Fisher-Yates shuffle. */
export function shuffle<T>(
  items: readonly T[],
  random: RandomSource,
): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function orderQuestions<T extends Question>(
  questions: readonly T[],
  shouldShuffle: boolean,
  seed: Seed = DEFAULT_ATTEMPT_SEED,
): T[] {
  return shouldShuffle
    ? shuffle(questions, createSeededRandom(seed))
    : [...questions];
}

export function orderOptions(
  question: Question,
  shouldShuffle: boolean,
  seed: Seed = DEFAULT_ATTEMPT_SEED,
): QuizOption[] {
  if (!shouldShuffle || question.optionOrderLocked) {
    return question.options.map((option) => ({ ...option }));
  }

  return shuffle(question.options, createSeededRandom(seed)).map((option) => ({
    ...option,
  }));
}

function clampQuestionCount(count: number | undefined, maximum: number): number {
  if (count === undefined || !Number.isFinite(count)) {
    return maximum;
  }

  return Math.min(maximum, Math.max(0, Math.floor(count)));
}

/**
 * Builds a serializable attempt. All display order is decided once here, so a
 * React re-render never changes question or option order.
 */
export function createAttempt(
  questions: readonly Question[],
  mode: QuizMode,
  preferences: AttemptPreferences = {},
  seed: Seed = DEFAULT_ATTEMPT_SEED,
): Attempt {
  const shuffleQuestions = preferences.shuffleQuestions ?? false;
  const shuffleOptions = preferences.shuffleOptions ?? false;
  const questionCount = clampQuestionCount(
    preferences.questionCount,
    questions.length,
  );
  const orderedQuestions = orderQuestions(
    questions,
    shuffleQuestions,
    `${seed}:questions`,
  ).slice(0, questionCount);

  const attemptQuestions = orderedQuestions.map((question) => ({
    ...question,
    options: orderOptions(
      question,
      shuffleOptions,
      `${seed}:options:${question.id}`,
    ),
    answerKeys: [...question.answerKeys],
  }));

  return {
    mode,
    prefs: {
      shuffleQuestions,
      shuffleOptions,
      questionCount,
    },
    seed,
    questions: attemptQuestions,
  };
}

/**
 * Fill answers ignore whitespace and punctuation (including Chinese full-width
 * punctuation), while preserving character and number order.
 */
export function normalizeFillAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{Z}\s]+/gu, "");
}

function setsMatch(actual: readonly string[], expected: readonly string[]): boolean {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  if (actualSet.size !== expectedSet.size) {
    return false;
  }

  for (const value of actualSet) {
    if (!expectedSet.has(value)) {
      return false;
    }
  }

  return true;
}

export function gradeQuestion(
  question: Question,
  selectedIds: readonly string[] = [],
  text = "",
): GradeResult {
  const selected = [...selectedIds];
  const isFill = question.type === "fill";
  const normalizedText = normalizeFillAnswer(text);
  const answered = isFill ? normalizedText.length > 0 : selected.length > 0;
  let correct: boolean | null = null;

  if (question.gradable) {
    if (isFill) {
      const normalizedExpected = normalizeFillAnswer(question.answerText ?? "");
      correct =
        normalizedExpected.length > 0 && normalizedText === normalizedExpected;
    } else {
      correct = setsMatch(selected, question.answerKeys);
    }
  }

  return {
    questionId: question.id,
    gradable: question.gradable,
    answered,
    correct,
    selectedIds: selected,
    text,
    correctIds: [...question.answerKeys],
    correctText: question.answerText,
  };
}

function getAttemptQuestions(
  attemptOrQuestions: Attempt | readonly Question[],
): readonly Question[] {
  return "questions" in attemptOrQuestions
    ? attemptOrQuestions.questions
    : attemptOrQuestions;
}

export function scoreAttempt(
  attemptOrQuestions: Attempt | readonly Question[],
  answers: AttemptAnswers,
): ScoreSummary {
  const questions = getAttemptQuestions(attemptOrQuestions);
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let excluded = 0;

  for (const question of questions) {
    if (!question.gradable) {
      excluded += 1;
      continue;
    }

    const answer = answers[question.id];
    const result = gradeQuestion(
      question,
      answer?.selectedIds ?? [],
      answer?.text ?? "",
    );

    if (!result.answered) {
      unanswered += 1;
    } else if (result.correct) {
      correct += 1;
    } else {
      incorrect += 1;
    }
  }

  const gradableTotal = correct + incorrect + unanswered;
  const percentage =
    gradableTotal === 0
      ? 0
      : Math.round((correct / gradableTotal) * 1000) / 10;

  return {
    total: gradableTotal,
    gradableTotal,
    answered: correct + incorrect,
    correct,
    incorrect,
    unanswered,
    excluded,
    percentage,
  };
}
