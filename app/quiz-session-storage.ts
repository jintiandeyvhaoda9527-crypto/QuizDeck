import { BUILTIN_BANK_ID, type QuestionScope, type QuizBank } from "./bank-types";
import {
  createAttempt,
  type Attempt,
  type AttemptAnswer,
  type QuizMode,
} from "./quiz-core";
import { questionBank } from "./question-bank";

export const LEGACY_ATTEMPT_STORAGE_KEY = "quizdeck:attempt:v1";
export const SESSIONS_STORAGE_KEY = "quizdeck:attempts:v2";

export interface SessionPreferences {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface QuizSession {
  bankId: string;
  bankVersion: string;
  scope: QuestionScope;
  attempt: Attempt;
  answers: Record<string, AttemptAnswer>;
  revealed: string[];
  cursor: number;
  submitted: boolean;
  reviewIndex: number;
}

export type QuizSessions = Record<string, QuizSession | undefined>;

interface LegacyStoredSession {
  schema: 1;
  bankVersion: string;
  mode: QuizMode;
  prefs: SessionPreferences;
  seed: string | number;
  answers: Record<string, AttemptAnswer>;
  revealed: string[];
  cursor: number;
  submitted: boolean;
  reviewIndex: number;
}

interface StoredSessionV2 {
  schema: 2;
  bankId: string;
  bankVersion: string;
  scope: QuestionScope;
  mode: QuizMode;
  prefs: SessionPreferences;
  seed: string | number;
  answers: Record<string, AttemptAnswer>;
  revealed: string[];
  cursor: number;
  submitted: boolean;
  reviewIndex: number;
}

interface StoredSessionCollectionV2 {
  schema: 2;
  sessions: Record<string, StoredSessionV2>;
}

function isPreferences(value: unknown): value is SessionPreferences {
  if (!value || typeof value !== "object") {
    return false;
  }
  const prefs = value as Partial<SessionPreferences>;
  return (
    typeof prefs.shuffleQuestions === "boolean" &&
    typeof prefs.shuffleOptions === "boolean"
  );
}

function isQuestionScope(value: unknown): value is QuestionScope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const scope = value as Partial<QuestionScope>;
  if (
    (scope.kind !== "all" &&
      scope.kind !== "category" &&
      scope.kind !== "partition" &&
      scope.kind !== "wrong") ||
    typeof scope.id !== "string" ||
    !scope.id.trim() ||
    typeof scope.name !== "string" ||
    !scope.name.trim() ||
    !Array.isArray(scope.questionIds) ||
    scope.questionIds.length === 0 ||
    scope.questionIds.some(
      (questionId) =>
        typeof questionId !== "string" || !questionId.trim(),
    )
  ) {
    return false;
  }

  if (scope.kind === "all" && scope.id !== "all") {
    return false;
  }

  return new Set(scope.questionIds).size === scope.questionIds.length;
}

function isLegacyStoredSession(value: unknown): value is LegacyStoredSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<LegacyStoredSession>;
  return (
    session.schema === 1 &&
    typeof session.bankVersion === "string" &&
    (session.mode === "practice" || session.mode === "exam") &&
    typeof session.seed !== "undefined" &&
    isPreferences(session.prefs) &&
    !!session.answers &&
    typeof session.answers === "object" &&
    Array.isArray(session.revealed) &&
    typeof session.cursor === "number" &&
    typeof session.submitted === "boolean" &&
    typeof session.reviewIndex === "number"
  );
}

function isStoredSessionV2(value: unknown): value is StoredSessionV2 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<StoredSessionV2>;
  return (
    session.schema === 2 &&
    typeof session.bankId === "string" &&
    !!session.bankId.trim() &&
    typeof session.bankVersion === "string" &&
    !!session.bankVersion.trim() &&
    isQuestionScope(session.scope) &&
    (session.mode === "practice" || session.mode === "exam") &&
    (typeof session.seed === "string" || typeof session.seed === "number") &&
    isPreferences(session.prefs) &&
    !!session.answers &&
    typeof session.answers === "object" &&
    !Array.isArray(session.answers) &&
    Array.isArray(session.revealed) &&
    session.revealed.every((questionId) => typeof questionId === "string") &&
    typeof session.cursor === "number" &&
    Number.isFinite(session.cursor) &&
    typeof session.submitted === "boolean" &&
    typeof session.reviewIndex === "number" &&
    Number.isFinite(session.reviewIndex)
  );
}

function sanitizeAnswers(
  attempt: Attempt,
  answers: Record<string, AttemptAnswer>,
) {
  const result: Record<string, AttemptAnswer> = {};

  for (const question of attempt.questions) {
    const answer = answers[question.id];
    if (!answer || !Array.isArray(answer.selectedIds)) {
      continue;
    }

    const validIds = new Set(question.options.map((option) => option.id));
    result[question.id] = {
      selectedIds: answer.selectedIds.filter(
        (id): id is string =>
          typeof id === "string" && validIds.has(id),
      ),
      text: typeof answer.text === "string" ? answer.text : "",
    };
  }

  return result;
}

function clampIndex(value: number, questionCount: number) {
  if (questionCount <= 0) {
    return 0;
  }
  return Math.min(questionCount - 1, Math.max(0, Math.floor(value)));
}

function restoreSession(
  bank: QuizBank,
  stored: StoredSessionV2,
): QuizSession | null {
  if (
    stored.bankId !== bank.id ||
    stored.bankVersion !== bank.version ||
    stored.scope.questionIds.length === 0
  ) {
    return null;
  }

  const requestedIds = new Set(stored.scope.questionIds);
  const sourceQuestions = bank.questions.filter((question) =>
    requestedIds.has(question.id),
  );
  if (sourceQuestions.length !== stored.scope.questionIds.length) {
    return null;
  }

  const attempt = createAttempt(
    sourceQuestions,
    stored.mode,
    {
      shuffleQuestions: stored.prefs.shuffleQuestions,
      shuffleOptions: stored.prefs.shuffleOptions,
      questionCount: sourceQuestions.length,
    },
    stored.seed,
  );
  const questionIds = new Set(
    attempt.questions.map((question) => question.id),
  );

  return {
    bankId: bank.id,
    bankVersion: bank.version,
    scope: {
      ...stored.scope,
      questionIds: sourceQuestions.map((question) => question.id),
    },
    attempt,
    answers: sanitizeAnswers(attempt, stored.answers),
    revealed: stored.revealed.filter(
      (id): id is string =>
        typeof id === "string" && questionIds.has(id),
    ),
    cursor: clampIndex(stored.cursor, attempt.questions.length),
    submitted: stored.submitted,
    reviewIndex: clampIndex(
      stored.reviewIndex,
      attempt.questions.length,
    ),
  };
}

function migrateLegacySession(
  bank: QuizBank,
  value: unknown,
): QuizSession | null {
  if (
    bank.id !== BUILTIN_BANK_ID ||
    !isLegacyStoredSession(value) ||
    value.bankVersion !== bank.version
  ) {
    return null;
  }

  const questionIds = bank.questions.map((question) => question.id);
  return restoreSession(bank, {
    schema: 2,
    bankId: bank.id,
    bankVersion: bank.version,
    scope: {
      kind: "all",
      id: "all",
      name: "全部题目",
      questionIds,
    },
    mode: value.mode,
    prefs: value.prefs,
    seed: value.seed,
    answers: value.answers,
    revealed: value.revealed,
    cursor: value.cursor,
    submitted: value.submitted,
    reviewIndex: value.reviewIndex,
  });
}

export function readStoredSessions(
  banks: readonly QuizBank[],
): QuizSessions {
  const banksById = new Map(banks.map((bank) => [bank.id, bank]));
  const result: QuizSessions = {};

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SESSIONS_STORAGE_KEY) ?? "null",
    ) as Partial<StoredSessionCollectionV2> | null;
    if (parsed?.schema === 2 && parsed.sessions) {
      for (const [bankId, value] of Object.entries(parsed.sessions)) {
        const bank = banksById.get(bankId);
        if (!bank || !isStoredSessionV2(value)) {
          continue;
        }
        const session = restoreSession(bank, value);
        if (session) {
          result[bankId] = session;
        }
      }
    }
  } catch {
    // A corrupt multi-bank session store does not block the bundled bank.
  }

  if (!result[BUILTIN_BANK_ID]) {
    try {
      const bank = banksById.get(BUILTIN_BANK_ID);
      const legacy = JSON.parse(
        window.localStorage.getItem(LEGACY_ATTEMPT_STORAGE_KEY) ?? "null",
      ) as unknown;
      const migrated = bank ? migrateLegacySession(bank, legacy) : null;
      if (migrated) {
        result[BUILTIN_BANK_ID] = migrated;
      }
    } catch {
      // Legacy progress is best-effort and remains untouched when invalid.
    }
  }

  return result;
}

function serializeSession(session: QuizSession): StoredSessionV2 {
  return {
    schema: 2,
    bankId: session.bankId,
    bankVersion: session.bankVersion,
    scope: {
      ...session.scope,
      questionIds: [...session.scope.questionIds],
    },
    mode: session.attempt.mode,
    prefs: {
      shuffleQuestions: session.attempt.prefs.shuffleQuestions,
      shuffleOptions: session.attempt.prefs.shuffleOptions,
    },
    seed: session.attempt.seed,
    answers: session.answers,
    revealed: session.revealed,
    cursor: session.cursor,
    submitted: session.submitted,
    reviewIndex: session.reviewIndex,
  };
}

function isCompleteBuiltInAllSession(
  session: QuizSession | undefined,
): session is QuizSession {
  if (
    !session ||
    session.bankId !== BUILTIN_BANK_ID ||
    session.bankVersion !== questionBank.version ||
    session.scope.kind !== "all" ||
    session.scope.id !== "all" ||
    session.scope.questionIds.length !== questionBank.questions.length ||
    session.attempt.questions.length !== questionBank.questions.length
  ) {
    return false;
  }

  const scopedIds = new Set(session.scope.questionIds);
  const attemptIds = new Set(
    session.attempt.questions.map((question) => question.id),
  );
  if (
    scopedIds.size !== questionBank.questions.length ||
    attemptIds.size !== questionBank.questions.length
  ) {
    return false;
  }

  return questionBank.questions.every(
    (question) =>
      scopedIds.has(question.id) && attemptIds.has(question.id),
  );
}

export function writeStoredSessions(
  sessions: QuizSessions,
  writeV2Collection = true,
) {
  const serializable = Object.fromEntries(
    Object.entries(sessions)
      .filter((entry): entry is [string, QuizSession] => Boolean(entry[1]))
      .map(([bankId, session]) => [bankId, serializeSession(session)]),
  );
  const collection: StoredSessionCollectionV2 = {
    schema: 2,
    sessions: serializable,
  };
  if (writeV2Collection) {
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify(collection),
    );
  }

  const builtIn = sessions[BUILTIN_BANK_ID];
  if (isCompleteBuiltInAllSession(builtIn)) {
    const legacy: LegacyStoredSession = {
      schema: 1,
      bankVersion: builtIn.bankVersion,
      mode: builtIn.attempt.mode,
      prefs: {
        shuffleQuestions: builtIn.attempt.prefs.shuffleQuestions,
        shuffleOptions: builtIn.attempt.prefs.shuffleOptions,
      },
      seed: builtIn.attempt.seed,
      answers: builtIn.answers,
      revealed: builtIn.revealed,
      cursor: builtIn.cursor,
      submitted: builtIn.submitted,
      reviewIndex: builtIn.reviewIndex,
    };
    window.localStorage.setItem(
      LEGACY_ATTEMPT_STORAGE_KEY,
      JSON.stringify(legacy),
    );
  } else {
    window.localStorage.removeItem(LEGACY_ATTEMPT_STORAGE_KEY);
  }
}
