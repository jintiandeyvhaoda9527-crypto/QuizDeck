"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAttempt,
  gradeQuestion,
  scoreAttempt,
  type AttemptAnswer,
  type GradeResult,
  type Question,
  type QuizMode,
} from "./quiz-core";
import {
  BUILTIN_BANK_ID,
  EMPTY_BANK_USER_STATE,
  getBankCounts,
  selectScopeQuestions,
  type ImportedBankDraft,
  type QuestionScope,
  type QuizBank,
} from "./bank-types";
import { createImportedBank, getBuiltInBank } from "./bank-catalog";
import {
  deleteImportedBank,
  loadImportedBanks,
  saveImportedBank,
} from "./bank-storage";
import {
  findDuplicateQuestionBank,
  getImportIssueDetails,
  removeBankScopedEntry,
  renameImportedBank,
} from "./bank-management";
import {
  createCustomPartition,
  deleteCustomPartition,
  getBankUserState,
  readBankUserStates,
  removeBankUserState,
  updateCustomPartition,
  writeBankUserStates,
  type BankUserStates,
} from "./bank-user-state";
import {
  readStoredSessions,
  writeStoredSessions,
  type QuizSession,
  type QuizSessions,
  type SessionPreferences,
} from "./quiz-session-storage";
import {
  clearAiConfiguration,
  createOpenAiCompatibleClient,
  generatePartitionCandidate,
  loadAiConfiguration,
  saveAiConfiguration,
  summarizePartitionIntent,
  testAiConnection,
  validateAiSettings,
  type AiConfiguration,
  type AiIntentSummary,
  type AiPartitionCandidate,
} from "./ai-core";
import { createPlatformAiApiKeyStore } from "./ai-secure-key-store";
import {
  dismissDemoBank,
  isDemoBankDismissed,
} from "./demo-bank-preference";
import { useI18n } from "./i18n";
import { getCoreErrorMessage } from "./i18n/core-messages";
import { getLibraryErrorMessage } from "./i18n/library-messages";
import {
  AiConfigScreen,
  AiPartitionConfirmScreen,
  AiPartitionIntentScreen,
  AiPartitionProcessingScreen,
  AiPartitionReviewScreen,
  BankDetail,
  DeleteBankConfirmDialog,
  DeletePartitionConfirmDialog,
  ImportIssueDetailsScreen,
  ImportResultSheet,
  LibraryHome,
  PartitionEditorScreen,
  RenameBankSheet,
  ScopeListScreen,
  ScopePracticeScreen,
  SettingsScreen,
  WrongQuestionsScreen,
  type AiConfigValue,
  type AiConnectionStatus,
} from "./library-screens";

const PREFERENCES_STORAGE_KEY = "quizdeck:preferences:v1";

type Screen =
  | "home"
  | "bank"
  | "categories"
  | "partitions"
  | "partitionEditor"
  | "importIssues"
  | "scope"
  | "wrong"
  | "settings"
  | "modelApi"
  | "aiIntent"
  | "aiConfirm"
  | "aiProcessing"
  | "aiReview"
  | "quiz"
  | "result";

type Preferences = SessionPreferences;
type Session = QuizSession;

const DEFAULT_PREFERENCES: Preferences = {
  shuffleQuestions: true,
  shuffleOptions: true,
};

const builtInBank = getBuiltInBank();
const aiApiKeyStore = createPlatformAiApiKeyStore();

type Translate = ReturnType<typeof useI18n>["t"];

function optionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function hasAnswer(question: Question, answer?: AttemptAnswer) {
  return gradeQuestion(
    question,
    answer?.selectedIds ?? [],
    answer?.text ?? "",
  ).answered;
}

function questionTypeLabel(type: Question["type"], t: Translate) {
  return t(`quiz.question.type.${type}`);
}

function correctAnswerText(question: Question, t: Translate) {
  if (question.type === "fill") {
    return question.answerText ?? "—";
  }

  return question.answerKeys
    .map((key) => {
      const displayedIndex = question.options.findIndex(
        (option) => option.id === key,
      );
      if (displayedIndex < 0) {
        return t("quiz.answer.sourceOptionMissing", { key });
      }

      const option = question.options[displayedIndex];
      return `${optionLabel(displayedIndex)}. ${option.text}`;
    })
    .join(t("quiz.answer.separator"));
}

function userAnswerText(
  question: Question,
  answer: AttemptAnswer | undefined,
  t: Translate,
) {
  if (!answer || !hasAnswer(question, answer)) {
    return t("quiz.answer.unanswered");
  }

  if (question.type === "fill") {
    return answer.text;
  }

  return answer.selectedIds
    .map((id) => {
      const displayedIndex = question.options.findIndex(
        (option) => option.id === id,
      );
      if (displayedIndex < 0) {
        return id;
      }

      const option = question.options[displayedIndex];
      return `${optionLabel(displayedIndex)}. ${option.text}`;
    })
    .join(t("quiz.answer.separator"));
}

function readStoredPreferences(): Preferences {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "null",
    ) as Partial<Preferences> | null;

    if (
      value &&
      typeof value.shuffleQuestions === "boolean" &&
      typeof value.shuffleOptions === "boolean"
    ) {
      return {
        shuffleQuestions: value.shuffleQuestions,
        shuffleOptions: value.shuffleOptions,
      };
    }
  } catch {
    // Storage is best-effort only; memory state remains fully usable.
  }

  return DEFAULT_PREFERENCES;
}

function createSeed() {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${Date.now()}-${randomPart}`;
}

function FeedbackCard({
  question,
  answer,
  grade,
  showUserAnswer,
}: {
  question: Question;
  answer?: AttemptAnswer;
  grade: GradeResult;
  showUserAnswer?: boolean;
}) {
  const { t } = useI18n();
  const state = !grade.gradable
    ? "ungraded"
    : grade.correct
      ? "correct"
      : "wrong";
  const title = !grade.gradable
    ? t("quiz.feedback.ungraded")
    : !grade.answered
      ? t("quiz.feedback.unanswered")
      : grade.correct
        ? t("quiz.feedback.correct")
        : t("quiz.feedback.wrong");
  const icon = !grade.gradable ? "!" : grade.correct ? "✓" : "×";

  return (
    <section
      className={`feedback-card ${state === "correct" ? "" : state}`}
      aria-live="polite"
      data-testid="answer-feedback"
    >
      <div className="feedback-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <h3 className="feedback-title">{title}</h3>
        {showUserAnswer ? (
          <p className="feedback-answer">
            {t("quiz.feedback.yourAnswer", {
              answer: userAnswerText(question, answer, t),
            })}
          </p>
        ) : null}
        <p className="feedback-answer">
          {t("quiz.feedback.correctAnswer", {
            answer: correctAnswerText(question, t),
          })}
        </p>
        {question.sourceIssue ? (
          <p className="feedback-note">
            {t("quiz.feedback.sourceIssue", {
              issue: question.sourceIssue,
            })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function QuestionCard({
  question,
  answer,
  revealed,
  review,
  onOption,
  onText,
}: {
  question: Question;
  answer?: AttemptAnswer;
  revealed: boolean;
  review?: boolean;
  onOption?: (optionId: string) => void;
  onText?: (value: string) => void;
}) {
  const { t } = useI18n();
  const grade = gradeQuestion(
    question,
    answer?.selectedIds ?? [],
    answer?.text ?? "",
  );
  const isLocked = revealed || review;

  return (
    <>
      <article className="question-card" data-testid="question-card">
        <h2 className="question-stem">{question.stem}</h2>
        <p className="question-hint">
          {question.type === "multiple"
            ? t("quiz.question.hint.multiple")
            : question.type === "fill"
              ? t("quiz.question.hint.fill")
              : t("quiz.question.hint.single")}
        </p>

        {question.type === "fill" ? (
          <div className="fill-wrap">
            <label className="fill-label" htmlFor={`fill-${question.id}`}>
              {t("quiz.question.yourAnswer")}
            </label>
            <textarea
              id={`fill-${question.id}`}
              className="fill-input"
              rows={2}
              value={answer?.text ?? ""}
              placeholder={t("quiz.question.fillPlaceholder")}
              disabled={isLocked}
              onChange={(event) => onText?.(event.target.value)}
              data-testid="fill-answer"
            />
          </div>
        ) : (
          <div
            className="option-list"
            role="group"
            aria-label={t("quiz.question.optionsAria")}
          >
            {question.options.map((option, index) => {
              const selected = answer?.selectedIds.includes(option.id) ?? false;
              const correct = isLocked && question.answerKeys.includes(option.id);
              const wrong = isLocked && selected && !question.answerKeys.includes(option.id);
              const stateClass = correct
                ? "correct"
                : wrong
                  ? "wrong"
                  : selected
                    ? "selected"
                    : "";

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`option-button ${stateClass}`}
                  aria-pressed={selected}
                  aria-label={t("quiz.question.optionAria", {
                    label: optionLabel(index),
                    option: option.text,
                  })}
                  disabled={isLocked}
                  onClick={() => onOption?.(option.id)}
                  data-testid={`option-${option.id}`}
                >
                  <span className="option-label" aria-hidden="true">
                    {optionLabel(index)}
                  </span>
                  <span className="option-text">{option.text}</span>
                  <span className="option-state" aria-hidden="true">
                    {correct ? "✓" : wrong ? "×" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </article>

      {isLocked ? (
        <FeedbackCard
          question={question}
          answer={answer}
          grade={grade}
          showUserAnswer={review}
        />
      ) : null}
    </>
  );
}

function AnswerSheet({
  session,
  currentIndex,
  review,
  onSelect,
  onClose,
  onSubmit,
}: {
  session: Session;
  currentIndex: number;
  review?: boolean;
  onSelect: (index: number) => void;
  onClose: () => void;
  onSubmit?: () => void;
}) {
  const { t } = useI18n();
  const currentButtonRef = useRef<HTMLButtonElement | null>(null);
  const answeredCount = session.attempt.questions.reduce(
    (count, question) =>
      count + (hasAnswer(question, session.answers[question.id]) ? 1 : 0),
    0,
  );

  useEffect(() => {
    currentButtonRef.current?.scrollIntoView({ block: "center" });
  }, [currentIndex]);

  return (
    <div className="sheet-backdrop" role="presentation">
      <section
        className={`bottom-sheet${onSubmit ? " has-submit" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="answer-sheet-title"
        data-testid="answer-sheet"
      >
        <header className="sheet-header">
          <h2 id="answer-sheet-title">{t("quiz.answerSheet.title")}</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label={t("quiz.answerSheet.closeAria")}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="sheet-body">
          <div className="answer-legend">
            {review ? (
              <>
                <span><i className="legend-dot correct" />{t("quiz.status.correct")}</span>
                <span><i className="legend-dot wrong" />{t("quiz.status.wrongOrUnanswered")}</span>
                <span><i className="legend-dot excluded" />{t("quiz.status.excluded")}</span>
              </>
            ) : (
              <>
                <span><i className="legend-dot answered" />{t("quiz.status.answered")}</span>
                <span><i className="legend-dot" />{t("quiz.status.unanswered")}</span>
              </>
            )}
            <span><i className="legend-dot current" />{t("quiz.status.current")}</span>
          </div>
          <div className="answer-grid">
            {session.attempt.questions.map((question, index) => {
              const answer = session.answers[question.id];
              const answered = hasAnswer(question, answer);
              const grade = gradeQuestion(
                question,
                answer?.selectedIds ?? [],
                answer?.text ?? "",
              );
              const reviewClass = !question.gradable
                ? "excluded"
                : grade.correct
                  ? "correct"
                  : "wrong";
              const stateClass = review
                ? reviewClass
                : answered
                  ? "answered"
                  : "";

              return (
                <button
                  key={question.id}
                  ref={index === currentIndex ? currentButtonRef : undefined}
                  type="button"
                  className={`answer-grid-button ${stateClass} ${index === currentIndex ? "current" : ""}`}
                  aria-label={t("quiz.answerSheet.questionAria", {
                    number: index + 1,
                    status: answered
                      ? t("quiz.status.answered")
                      : t("quiz.status.unanswered"),
                  })}
                  onClick={() => onSelect(index)}
                  data-testid={`answer-jump-${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
        {onSubmit ? (
          <footer className="sheet-submit-bar">
            <span>
              {t("quiz.answerSheet.answeredLabel")} <strong>{answeredCount}</strong>{" "}
              / {session.attempt.questions.length}
            </span>
            <button type="button" onClick={onSubmit}>
              {t("quiz.action.submit")}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function SubmitDialog({
  unanswered,
  onCancel,
  onSubmit,
}: {
  unanswered: number;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="sheet-backdrop" role="presentation">
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        data-testid="submit-dialog"
      >
        <h2 id="submit-title">{t("quiz.submit.title")}</h2>
        <p>
          {unanswered > 0
            ? t("quiz.submit.withUnanswered", { count: unanswered })
            : t("quiz.submit.allAnswered")}
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t("quiz.submit.continue")}
          </button>
          <button
            type="button"
            className="primary-button finish"
            onClick={onSubmit}
            data-testid="confirm-submit"
          >
            {t("quiz.submit.confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}

function OperationErrorDialog({
  title,
  message,
  onClose,
}: {
  title?: string;
  message: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="sheet-backdrop">
      <section
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="operation-error-title"
      >
        <h2 id="operation-error-title">
          {title ?? t("quiz.error.operationTitle")}
        </h2>
        <p>{message}</p>
        <button type="button" className="primary-button" onClick={onClose}>
          {t("quiz.action.dismiss")}
        </button>
      </section>
    </div>
  );
}

export function QuizApp() {
  const { locale, t } = useI18n();
  const localeRef = useRef(locale);
  const tRef = useRef(t);
  const [screen, setScreen] = useState<Screen>("home");
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [banks, setBanks] = useState<QuizBank[]>([builtInBank]);
  const [sessions, setSessions] = useState<QuizSessions>({});
  const [bankUserStates, setBankUserStates] =
    useState<BankUserStates>({});
  const [activeBankId, setActiveBankId] =
    useState<string>(BUILTIN_BANK_ID);
  const [selectedScope, setSelectedScope] =
    useState<QuestionScope | null>(null);
  const [importDraft, setImportDraft] =
    useState<ImportedBankDraft | null>(null);
  const [duplicateBankName, setDuplicateBankName] =
    useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [renameBankOpen, setRenameBankOpen] = useState(false);
  const [deleteBankOpen, setDeleteBankOpen] = useState(false);
  const [editingPartitionId, setEditingPartitionId] =
    useState<string | null>(null);
  const [pendingPartitionDeleteId, setPendingPartitionDeleteId] =
    useState<string | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [aiConfiguration, setAiConfiguration] =
    useState<AiConfiguration | null>(null);
  const [aiConfigStatus, setAiConfigStatus] =
    useState<AiConnectionStatus>("unconfigured");
  const [aiConfigStatusMessage, setAiConfigStatusMessage] =
    useState<string | undefined>(undefined);
  const [aiConfigAction, setAiConfigAction] =
    useState<"idle" | "testing" | "saving" | "clearing">("idle");
  const [aiConfigReturn, setAiConfigReturn] =
    useState<"settings" | "aiIntent">("settings");
  const [aiIntent, setAiIntent] = useState("");
  const [aiIntentSummary, setAiIntentSummary] =
    useState<AiIntentSummary | null>(null);
  const [aiIntentBusy, setAiIntentBusy] = useState(false);
  const [aiIntentError, setAiIntentError] = useState<string | null>(null);
  const [aiCandidate, setAiCandidate] =
    useState<AiPartitionCandidate | null>(null);
  const [aiProcessingError, setAiProcessingError] =
    useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [libraryStorageReady, setLibraryStorageReady] = useState(false);
  const [answerSheetOpen, setAnswerSheetOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [settingsReturn, setSettingsReturn] =
    useState<"home" | "bank">("home");
  const aiIntentRunIdRef = useRef(0);
  const aiIntentAbortControllerRef = useRef<AbortController | null>(null);
  const aiRunIdRef = useRef(0);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const activeBank =
    banks.find((bank) => bank.id === activeBankId) ?? builtInBank;
  const session = sessions[activeBank.id] ?? null;
  const activeUserState = getBankUserState(
    bankUserStates,
    activeBank.id,
  );
  const editingPartition = editingPartitionId
    ? activeUserState.partitions.find(
        (partition) => partition.id === editingPartitionId,
      ) ?? null
    : null;
  const pendingPartitionDelete = pendingPartitionDeleteId
    ? activeUserState.partitions.find(
        (partition) => partition.id === pendingPartitionDeleteId,
      ) ?? null
    : null;
  const aiConfigured = Boolean(aiConfiguration);

  useEffect(() => {
    localeRef.current = locale;
    tRef.current = t;
  }, [locale, t]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLocalLibrary() {
      let importedBanks: QuizBank[] = [];
      let importedLibraryLoaded = false;
      let storedAiConfiguration: AiConfiguration | null = null;
      let aiConfigurationLoadError: string | null = null;
      try {
        importedBanks = await loadImportedBanks();
        importedLibraryLoaded = true;
      } catch {
        // The optional demo remains usable when IndexedDB is unavailable.
      }
      try {
        storedAiConfiguration = await loadAiConfiguration(aiApiKeyStore);
      } catch (error) {
        aiConfigurationLoadError =
          getCoreErrorMessage(localeRef.current, error) ??
          (error instanceof Error
            ? error.message
            : tRef.current("quiz.error.aiConfigurationLoad"));
      }

      if (cancelled) {
        return;
      }

      const availableBanks = [
        ...(isDemoBankDismissed() ? [] : [builtInBank]),
        ...importedBanks,
      ];
      setBanks(availableBanks);
      setActiveBankId(availableBanks[0]?.id ?? "");
      setPreferences(readStoredPreferences());
      setSessions(readStoredSessions(availableBanks));
      setBankUserStates(readBankUserStates(availableBanks));
      setLibraryStorageReady(importedLibraryLoaded);
      setAiConfiguration(storedAiConfiguration);
      setAiConfigStatus(
        aiConfigurationLoadError
          ? "error"
          : storedAiConfiguration
            ? "saved"
            : "unconfigured",
      );
      setAiConfigStatusMessage(aiConfigurationLoadError ?? undefined);
      setHydrated(true);
    }

    void hydrateLocalLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // Preferences simply remain in memory when storage is unavailable.
    }
  }, [hydrated, preferences]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        writeStoredSessions(sessions, libraryStorageReady);
      } catch {
        // Active attempts continue in memory if storage is full or restricted.
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [hydrated, libraryStorageReady, sessions]);

  useEffect(() => {
    if (!hydrated || !libraryStorageReady) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        writeBankUserStates(bankUserStates);
      } catch {
        // Partitions and wrong-question records remain usable in memory.
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [bankUserStates, hydrated, libraryStorageReady]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen, session?.cursor, session?.reviewIndex]);

  const score = useMemo(
    () => (session ? scoreAttempt(session.attempt, session.answers) : null),
    [session],
  );

  const answeredCount = useMemo(() => {
    if (!session) {
      return 0;
    }
    return session.attempt.questions.filter((question) =>
      hasAnswer(question, session.answers[question.id]),
    ).length;
  }, [session]);

  const sessionSummary = useMemo(() => {
    if (!session) {
      return null;
    }

    const total = session.attempt.questions.length;
    const percentage = total > 0
      ? Math.round((answeredCount / total) * 100)
      : 0;
    const label = session.attempt.mode === "exam"
      ? t("quiz.mode.exam")
      : session.attempt.prefs.shuffleQuestions
        ? t("quiz.mode.randomPractice")
        : t("quiz.mode.sequentialPractice");

    return {
      answered: answeredCount,
      total,
      percentage,
      label,
      submitted: session.submitted,
      score: score?.percentage,
    };
  }, [answeredCount, score?.percentage, session, t]);

  const bankCards = useMemo(
    () =>
      banks.map((bank) => {
        const counts = getBankCounts(bank);
        const bankSession = sessions[bank.id] ?? null;
        const answered = bankSession
          ? bankSession.attempt.questions.filter((question) =>
              hasAnswer(question, bankSession.answers[question.id]),
            ).length
          : 0;
        const total = bankSession?.attempt.questions.length ?? 0;
        const percentage =
          total > 0 ? Math.round((answered / total) * 100) : 0;
        const summary = bankSession
          ? {
              answered,
              total,
              percentage,
              label:
                bankSession.attempt.mode === "exam"
                  ? t("quiz.mode.exam")
                  : bankSession.attempt.prefs.shuffleQuestions
                    ? t("quiz.mode.randomPractice")
                    : t("quiz.mode.sequentialPractice"),
              submitted: bankSession.submitted,
              score: bankSession.submitted
                ? scoreAttempt(
                    bankSession.attempt,
                    bankSession.answers,
                  ).percentage
                : undefined,
            }
          : null;

        return {
          id: bank.id,
          name: bank.name,
          questionCount: counts.questionCount,
          gradableCount: counts.gradableCount,
          session: summary,
        };
      }),
    [banks, sessions, t],
  );

  const setSession = (
    update:
      | Session
      | null
      | ((current: Session | null) => Session | null),
  ) => {
    setSessions((currentSessions) => {
      const current = currentSessions[activeBank.id] ?? null;
      const next =
        typeof update === "function" ? update(current) : update;
      const updated = { ...currentSessions };

      if (next) {
        if (next.bankId !== activeBank.id) {
          return currentSessions;
        }
        updated[activeBank.id] = next;
      } else {
        delete updated[activeBank.id];
      }

      return updated;
    });
  };

  const allScopeForBank = (bank: QuizBank): QuestionScope => ({
    kind: "all",
    id: "all",
    name: t("quiz.scope.allQuestions"),
    questionIds: bank.questions.map((question) => question.id),
  });

  const startAttempt = (
    bankId: string,
    mode: QuizMode,
    overrides: Partial<Preferences> = {},
    requestedScope?: QuestionScope,
  ) => {
    const bank = banks.find((item) => item.id === bankId);
    if (!bank) {
      return;
    }

    const scope = requestedScope ?? allScopeForBank(bank);
    const scopedQuestions = selectScopeQuestions(
      bank,
      scope.questionIds,
    );
    if (scopedQuestions.length === 0) {
      return;
    }

    const attemptPreferences = {
      ...preferences,
      ...overrides,
    };
    const attempt = createAttempt(
      scopedQuestions,
      mode,
      {
        ...attemptPreferences,
        questionCount: scopedQuestions.length,
      },
      createSeed(),
    );
    const nextSession: Session = {
      bankId: bank.id,
      bankVersion: bank.version,
      scope: {
        ...scope,
        questionIds: scopedQuestions.map((question) => question.id),
      },
      attempt,
      answers: {},
      revealed: [],
      cursor: 0,
      submitted: false,
      reviewIndex: 0,
    };

    setActiveBankId(bank.id);
    setSessions((current) => ({
      ...current,
      [bank.id]: nextSession,
    }));
    setAnswerSheetOpen(false);
    setSubmitDialogOpen(false);
    setScreen("quiz");
  };

  const recordWrongQuestions = (
    bankId: string,
    questionIds: readonly string[],
  ) => {
    if (questionIds.length === 0) {
      return;
    }

    const bank = banks.find((item) => item.id === bankId);
    if (!bank) {
      return;
    }
    const validQuestionIds = new Set(
      bank.questions.map((question) => question.id),
    );
    const filteredQuestionIds = questionIds.filter((id) =>
      validQuestionIds.has(id)
    );
    if (filteredQuestionIds.length === 0) {
      return;
    }

    setBankUserStates((current) => {
      const state = getBankUserState(current, bankId);
      return {
        ...current,
        [bankId]: {
          ...state,
          wrongQuestionIds: Array.from(
            new Set([...state.wrongQuestionIds, ...filteredQuestionIds]),
          ),
        },
      };
    });
  };

  const updateCurrentAnswer = (
    update: (answer: AttemptAnswer, question: Question) => AttemptAnswer,
    revealSingle = false,
  ) => {
    setSession((current) => {
      if (!current || current.submitted) {
        return current;
      }

      const question = current.attempt.questions[current.cursor];
      if (
        current.attempt.mode === "practice" &&
        current.revealed.includes(question.id)
      ) {
        return current;
      }

      const existing = current.answers[question.id] ?? {
        selectedIds: [],
        text: "",
      };
      const nextAnswer = update(existing, question);
      const shouldReveal =
        revealSingle &&
        current.attempt.mode === "practice" &&
        (question.type === "single" || question.type === "judge");

      return {
        ...current,
        answers: {
          ...current.answers,
          [question.id]: nextAnswer,
        },
        revealed:
          shouldReveal && !current.revealed.includes(question.id)
            ? [...current.revealed, question.id]
            : current.revealed,
      };
    });
  };

  const selectOption = (optionId: string) => {
    if (session && session.attempt.mode === "practice") {
      const question = session.attempt.questions[session.cursor];
      if (
        !session.revealed.includes(question.id) &&
        (question.type === "single" || question.type === "judge")
      ) {
        const nextAnswer = {
          selectedIds: [optionId],
          text: session.answers[question.id]?.text ?? "",
        };
        const grade = gradeQuestion(
          question,
          nextAnswer.selectedIds,
          nextAnswer.text,
        );
        if (grade.gradable && grade.answered && !grade.correct) {
          recordWrongQuestions(session.bankId, [question.id]);
        }
      }
    }

    updateCurrentAnswer((answer, question) => {
      if (question.type === "multiple") {
        const selectedIds = answer.selectedIds.includes(optionId)
          ? answer.selectedIds.filter((id) => id !== optionId)
          : [...answer.selectedIds, optionId];
        return { ...answer, selectedIds };
      }

      return { ...answer, selectedIds: [optionId] };
    }, true);
  };

  const updateFillAnswer = (text: string) => {
    updateCurrentAnswer((answer) => ({ ...answer, text }));
  };

  const confirmPracticeAnswer = () => {
    if (session) {
      const question = session.attempt.questions[session.cursor];
      const answer = session.answers[question.id];
      const grade = gradeQuestion(
        question,
        answer?.selectedIds ?? [],
        answer?.text ?? "",
      );
      if (
        !session.revealed.includes(question.id) &&
        grade.gradable &&
        grade.answered &&
        !grade.correct
      ) {
        recordWrongQuestions(session.bankId, [question.id]);
      }
    }

    setSession((current) => {
      if (!current) {
        return current;
      }
      const question = current.attempt.questions[current.cursor];
      const answer = current.answers[question.id];
      if (!hasAnswer(question, answer) || current.revealed.includes(question.id)) {
        return current;
      }

      return {
        ...current,
        revealed: [...current.revealed, question.id],
      };
    });
  };

  const finishAttempt = (current: Session) => {
    const firstWrongIndex = current.attempt.questions.findIndex((question) => {
      if (!question.gradable) {
        return false;
      }
      const answer = current.answers[question.id];
      return !gradeQuestion(
        question,
        answer?.selectedIds ?? [],
        answer?.text ?? "",
      ).correct;
    });

    return {
      ...current,
      submitted: true,
      reviewIndex: firstWrongIndex >= 0 ? firstWrongIndex : 0,
    };
  };

  const goNextPractice = () => {
    if (!session) {
      return;
    }

    if (session.cursor >= session.attempt.questions.length - 1) {
      setSession((current) => (current ? finishAttempt(current) : current));
      setScreen("result");
      return;
    }

    setSession((current) =>
      current ? { ...current, cursor: current.cursor + 1 } : current,
    );
  };

  const submitExam = () => {
    if (session) {
      const wrongIds = session.attempt.questions
        .filter((question) => {
          const answer = session.answers[question.id];
          const grade = gradeQuestion(
            question,
            answer?.selectedIds ?? [],
            answer?.text ?? "",
          );
          return grade.gradable && grade.answered && !grade.correct;
        })
        .map((question) => question.id);
      recordWrongQuestions(session.bankId, wrongIds);
    }

    setSession((current) => (current ? finishAttempt(current) : current));
    setSubmitDialogOpen(false);
    setAnswerSheetOpen(false);
    setScreen("result");
  };

  const returnToBank = () => {
    setAnswerSheetOpen(false);
    setSubmitDialogOpen(false);
    setScreen("bank");
  };

  const handleImportFile = async (file: File) => {
    if (!hydrated || importBusy) {
      return;
    }
    if (!libraryStorageReady) {
      setImportError(
        t("quiz.error.localBankStorageUnavailable"),
      );
      return;
    }
    setImportBusy(true);
    setImportError(null);

    try {
      const { parseQuestionBankFile } = await import(
        "./question-bank-import"
      );
      const draft = await parseQuestionBankFile(file);
      const duplicate = findDuplicateQuestionBank(draft, banks);
      setImportDraft(draft);
      setDuplicateBankName(duplicate?.name ?? null);
    } catch (error) {
      setDuplicateBankName(null);
      setImportError(
        getLibraryErrorMessage(locale, error) ?? t("quiz.error.fileParse"),
      );
    } finally {
      setImportBusy(false);
    }
  };

  const confirmImport = async (bankName: string) => {
    if (!importDraft || importBusy || !libraryStorageReady) {
      return;
    }

    setImportBusy(true);
    setImportError(null);

    try {
      const bank = createImportedBank(importDraft, bankName);
      await saveImportedBank(bank);
      try {
        await globalThis.navigator?.storage?.persist?.();
      } catch {
        // Persistence is best-effort; IndexedDB remains the source of truth.
      }
      setBanks((current) => [...current, bank]);
      setBankUserStates((current) => ({
        ...current,
        [bank.id]: { ...EMPTY_BANK_USER_STATE },
      }));
      setActiveBankId(bank.id);
      setImportDraft(null);
      setDuplicateBankName(null);
      setScreen("bank");
    } catch (error) {
      setImportError(
        getLibraryErrorMessage(locale, error) ?? t("quiz.error.bankSave"),
      );
    } finally {
      setImportBusy(false);
    }
  };

  const openScope = (scope: QuestionScope) => {
    setSelectedScope(scope);
    setScreen("scope");
  };

  const savePartition = (
    requestedName: string,
    requestedQuestionIds: string[],
  ) => {
    try {
      const nextState = editingPartitionId
        ? updateCustomPartition(
            activeUserState,
            activeBank,
            editingPartitionId,
            {
              name: requestedName,
              questionIds: requestedQuestionIds,
            },
          )
        : createCustomPartition(activeUserState, activeBank, {
            id: `partition-${createSeed()}`,
            name: requestedName,
            questionIds: requestedQuestionIds,
            createdAt: new Date().toISOString(),
          });
      setBankUserStates((current) => ({
        ...current,
        [activeBank.id]: nextState,
      }));
      if (editingPartitionId) {
        setSessions((current) => {
          const currentSession = current[activeBank.id];
          return currentSession?.scope.kind === "partition" &&
              currentSession.scope.id === editingPartitionId
            ? removeBankScopedEntry(current, activeBank.id)
            : current;
        });
      }
      setEditingPartitionId(null);
      setScreen("partitions");
    } catch (error) {
      setOperationError(
        getLibraryErrorMessage(locale, error) ??
          t("quiz.error.partitionSave"),
      );
    }
  };

  const confirmDeletePartition = () => {
    if (!pendingPartitionDeleteId) {
      return;
    }
    setBankUserStates((current) => {
      const state = getBankUserState(current, activeBank.id);
      return {
        ...current,
        [activeBank.id]: deleteCustomPartition(
          state,
          pendingPartitionDeleteId,
        ),
      };
    });
    setSessions((current) => {
      const currentSession = current[activeBank.id];
      return currentSession?.scope.kind === "partition" &&
          currentSession.scope.id === pendingPartitionDeleteId
        ? removeBankScopedEntry(current, activeBank.id)
        : current;
    });
    setPendingPartitionDeleteId(null);
  };

  const handleRenameBank = async (requestedName: string) => {
    if (operationBusy || activeBank.builtIn) {
      return;
    }
    setOperationBusy(true);
    setOperationError(null);
    try {
      const renamed = renameImportedBank(activeBank, requestedName);
      await saveImportedBank(renamed);
      setBanks((current) =>
        current.map((bank) => (bank.id === renamed.id ? renamed : bank)),
      );
      setRenameBankOpen(false);
    } catch (error) {
      setOperationError(
        getLibraryErrorMessage(locale, error) ?? t("quiz.error.bankRename"),
      );
    } finally {
      setOperationBusy(false);
    }
  };

  const handleDeleteBank = async () => {
    if (operationBusy) {
      return;
    }
    const bankId = activeBank.id;
    const deletingDemo = bankId === BUILTIN_BANK_ID;
    if (activeBank.builtIn && !deletingDemo) {
      return;
    }
    setOperationBusy(true);
    setOperationError(null);
    try {
      if (deletingDemo) {
        dismissDemoBank();
      } else {
        await deleteImportedBank(bankId);
      }
      const nextSessions = removeBankScopedEntry(sessions, bankId);
      const nextBankUserStates = removeBankUserState(
        bankUserStates,
        bankId,
      );
      setSessions(nextSessions);
      setBankUserStates(nextBankUserStates);
      try {
        writeStoredSessions(nextSessions, libraryStorageReady);
        writeBankUserStates(nextBankUserStates);
      } catch {
        // The deleted bank remains absent from this run even if storage is full.
      }
      const remainingBanks = banks.filter((bank) => bank.id !== bankId);
      setBanks(remainingBanks);
      setDeleteBankOpen(false);
      setSelectedScope(null);
      setEditingPartitionId(null);
      setActiveBankId(remainingBanks[0]?.id ?? "");
      setScreen("home");
    } catch (error) {
      setOperationError(
        getLibraryErrorMessage(locale, error) ?? t("quiz.error.bankDelete"),
      );
    } finally {
      setOperationBusy(false);
    }
  };

  const handleTestAiConnection = async (value: AiConfigValue) => {
    if (aiConfigAction !== "idle") {
      return;
    }
    setAiConfigAction("testing");
    setAiConfigStatus("testing");
    setAiConfigStatusMessage(t("quiz.ai.connection.testing"));
    try {
      const testedSettings = validateAiSettings({
        apiBaseUrl: value.baseUrl,
        model: value.model,
        timeoutMs: 60_000,
      });
      const client = createOpenAiCompatibleClient({
        apiBaseUrl: testedSettings.apiBaseUrl,
        apiKey: value.apiKey,
        model: testedSettings.model,
        timeoutMs: testedSettings.timeoutMs,
      });
      const result = await testAiConnection(client);
      setAiConfigStatus("connected");
      setAiConfigStatusMessage(
        t("quiz.ai.connection.success", {
          model: testedSettings.model,
          latencyMs: result.latencyMs,
        }),
      );
    } catch (error) {
      setAiConfigStatus("error");
      setAiConfigStatusMessage(
        getCoreErrorMessage(locale, error) ??
          (error instanceof Error
            ? error.message
            : t("quiz.error.aiConnectionTest")),
      );
    } finally {
      setAiConfigAction("idle");
    }
  };

  const handleSaveAiConfiguration = async (value: AiConfigValue) => {
    if (aiConfigAction !== "idle") {
      return;
    }
    setAiConfigAction("saving");
    setAiConfigStatusMessage(undefined);
    try {
      await saveAiConfiguration(
        {
          apiBaseUrl: value.baseUrl,
          apiKey: value.apiKey,
          model: value.model,
          timeoutMs: 60_000,
        },
        aiApiKeyStore,
      );
      const saved = await loadAiConfiguration(aiApiKeyStore);
      if (!saved) {
        throw new Error(t("quiz.error.aiConfigurationUnreadable"));
      }
      setAiConfiguration(saved);
      setAiConfigStatus("saved");
      setAiConfigStatusMessage(t("quiz.ai.configuration.saved"));
    } catch (error) {
      setAiConfigStatus("error");
      setAiConfigStatusMessage(
        getCoreErrorMessage(locale, error) ??
          (error instanceof Error
            ? error.message
            : t("quiz.error.aiConfigurationSave")),
      );
    } finally {
      setAiConfigAction("idle");
    }
  };

  const handleClearAiConfiguration = async () => {
    if (aiConfigAction !== "idle") {
      return;
    }
    setAiConfigAction("clearing");
    setAiConfigStatusMessage(undefined);
    try {
      await clearAiConfiguration(aiApiKeyStore);
      setAiConfiguration(null);
      setAiConfigStatus("unconfigured");
      setAiConfigStatusMessage(
        t("quiz.ai.configuration.cleared"),
      );
    } catch (error) {
      setAiConfigStatus("error");
      setAiConfigStatusMessage(
        getCoreErrorMessage(locale, error) ??
          (error instanceof Error
            ? error.message
            : t("quiz.error.aiConfigurationClear")),
      );
    } finally {
      setAiConfigAction("idle");
    }
  };

  const continueAiPartitionIntent = async (intent: string) => {
    if (aiIntentBusy) {
      return;
    }

    const normalizedIntent = intent.trim();
    setAiIntent(normalizedIntent);
    setAiIntentSummary(null);
    setAiCandidate(null);
    setAiIntentError(null);
    setAiProcessingError(null);

    if (!aiConfiguration) {
      setAiIntentError(t("quiz.error.aiConfigurationRequired"));
      return;
    }

    const runId = aiIntentRunIdRef.current + 1;
    aiIntentRunIdRef.current = runId;
    aiIntentAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    aiIntentAbortControllerRef.current = abortController;
    const bank = activeBank;
    setAiIntentBusy(true);

    try {
      const client = createOpenAiCompatibleClient(aiConfiguration);
      const summary = await summarizePartitionIntent(
        client,
        bank,
        normalizedIntent,
        { locale, signal: abortController.signal },
      );
      if (aiIntentRunIdRef.current !== runId) {
        return;
      }
      setAiIntentSummary(summary);
      setScreen("aiConfirm");
    } catch (error) {
      if (
        aiIntentRunIdRef.current !== runId ||
        abortController.signal.aborted
      ) {
        return;
      }
      setAiIntentError(
        getCoreErrorMessage(locale, error) ??
          (error instanceof Error
            ? error.message
            : t("quiz.error.aiIntentSummary")),
      );
    } finally {
      if (aiIntentAbortControllerRef.current === abortController) {
        aiIntentAbortControllerRef.current = null;
      }
      if (aiIntentRunIdRef.current === runId) {
        setAiIntentBusy(false);
      }
    }
  };

  const runAiPartition = async () => {
    if (!aiConfiguration || !aiIntentSummary) {
      setAiProcessingError(t("quiz.error.aiConfigurationRequired"));
      setScreen("aiProcessing");
      return;
    }

    const runId = aiRunIdRef.current + 1;
    aiRunIdRef.current = runId;
    aiAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;
    const bank = activeBank;
    setAiProcessingError(null);
    setScreen("aiProcessing");
    try {
      const client = createOpenAiCompatibleClient(aiConfiguration);
      const candidate = await generatePartitionCandidate(
        client,
        bank,
        aiIntentSummary,
        { locale, signal: abortController.signal },
      );
      if (aiRunIdRef.current !== runId) {
        return;
      }
      setAiCandidate(candidate);
      setScreen("aiReview");
    } catch (error) {
      if (
        aiRunIdRef.current !== runId ||
        abortController.signal.aborted
      ) {
        return;
      }
      setAiProcessingError(
        getCoreErrorMessage(locale, error) ??
          (error instanceof Error
            ? error.message
            : t("quiz.error.aiPartitionGeneration")),
      );
    } finally {
      if (aiAbortControllerRef.current === abortController) {
        aiAbortControllerRef.current = null;
      }
    }
  };

  const removeWrongQuestion = (questionId: string) => {
    setBankUserStates((current) => {
      const state = getBankUserState(current, activeBank.id);
      return {
        ...current,
        [activeBank.id]: {
          ...state,
          wrongQuestionIds: state.wrongQuestionIds.filter(
            (id) => id !== questionId,
          ),
        },
      };
    });
  };

  if (screen === "home") {
    return (
      <>
        <LibraryHome
          banks={bankCards}
          onOpenBank={(bankId) => {
            if (!hydrated) {
              return;
            }
            setActiveBankId(bankId);
            setScreen("bank");
          }}
          onPrimaryAction={(bankId) => {
            if (!hydrated) {
              return;
            }
            setActiveBankId(bankId);
            const bankSession = sessions[bankId];
            if (bankSession) {
              setScreen(bankSession.submitted ? "result" : "quiz");
              return;
            }
            startAttempt(
              bankId,
              "practice",
              {
                shuffleQuestions: false,
                shuffleOptions: false,
              },
            );
          }}
          onImportFile={(file) => void handleImportFile(file)}
          onOpenSettings={() => {
            setSettingsReturn("home");
            setScreen("settings");
          }}
        />
        {importDraft ? (
          <ImportResultSheet
            initialName={importDraft.suggestedName}
            questionCount={importDraft.questions.length}
            categoryCount={importDraft.categories.length}
            issueCount={importDraft.importIssues.length}
            duplicateBankName={duplicateBankName ?? undefined}
            issueSummary={
              importDraft.importIssues.length > 0
                ? t("quiz.import.issueSummary", {
                    count: importDraft.importIssues.length,
                  })
                : undefined
            }
            onSave={(bankName) => void confirmImport(bankName)}
            onCancel={() => {
              if (!importBusy) {
                setImportDraft(null);
                setDuplicateBankName(null);
              }
            }}
          />
        ) : null}
        {importBusy && !importDraft ? (
          <div className="sheet-backdrop">
            <section className="modal-card" role="status">
              <h2>{t("quiz.import.readingTitle")}</h2>
              <p>{t("quiz.import.readingDescription")}</p>
            </section>
          </div>
        ) : null}
        {importError ? (
          <div className="sheet-backdrop">
            <section
              className="modal-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="import-error-title"
            >
              <h2 id="import-error-title">{t("quiz.import.errorTitle")}</h2>
              <p>{importError}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setImportError(null)}
              >
                {t("quiz.action.dismiss")}
              </button>
            </section>
          </div>
        ) : null}
      </>
    );
  }

  if (screen === "bank") {
    const counts = getBankCounts(activeBank);
    return (
      <>
        <BankDetail
          bankName={activeBank.name}
          isImported={!activeBank.builtIn}
          questionCount={counts.questionCount}
          gradableCount={counts.gradableCount}
          typeCounts={counts.typeCounts}
          categoryCount={activeBank.categories.length}
          partitionCount={activeUserState.partitions.length}
          wrongCount={activeUserState.wrongQuestionIds.length}
          session={sessionSummary}
          importIssueCount={activeBank.importIssues.length}
          onBack={() => setScreen("home")}
          onResume={() => setScreen(session?.submitted ? "result" : "quiz")}
          onStartSequential={() =>
            startAttempt(
              activeBank.id,
              "practice",
              {
                shuffleQuestions: false,
                shuffleOptions: false,
              },
            )
          }
          onStartRandom={() =>
            startAttempt(
              activeBank.id,
              "practice",
              {
                shuffleQuestions: true,
                shuffleOptions: true,
              },
            )
          }
          onStartExam={() => startAttempt(activeBank.id, "exam")}
          onOpenAllQuestions={() => openScope(allScopeForBank(activeBank))}
          onOpenCategories={() => setScreen("categories")}
          onOpenPartitions={() => setScreen("partitions")}
          onOpenWrongQuestions={() => setScreen("wrong")}
          onOpenImportIssues={activeBank.builtIn
            ? undefined
            : () => setScreen("importIssues")}
          onRenameBank={activeBank.builtIn
            ? undefined
            : () => setRenameBankOpen(true)}
          onDeleteBank={() => setDeleteBankOpen(true)}
          onOpenSettings={() => {
            setSettingsReturn("bank");
            setScreen("settings");
          }}
        />
        {renameBankOpen ? (
          <RenameBankSheet
            currentName={activeBank.name}
            onCancel={() => {
              if (!operationBusy) {
                setRenameBankOpen(false);
              }
            }}
            onSave={(name) => void handleRenameBank(name)}
          />
        ) : null}
        {deleteBankOpen ? (
          <DeleteBankConfirmDialog
            bankName={activeBank.name}
            onCancel={() => {
              if (!operationBusy) {
                setDeleteBankOpen(false);
              }
            }}
            onConfirm={() => void handleDeleteBank()}
          />
        ) : null}
        {operationError ? (
          <OperationErrorDialog
            message={operationError}
            onClose={() => setOperationError(null)}
          />
        ) : null}
      </>
    );
  }

  if (screen === "importIssues") {
    const issues = getImportIssueDetails(activeBank);
    return (
      <ImportIssueDetailsScreen
        bankName={activeBank.name}
        sourceFileName={activeBank.sourceFileName}
        issues={issues.map((issue, index) => ({
          id: `${issue.code}-${issue.questionId ?? "file"}-${index}`,
          code: issue.code,
          severity: issue.severity,
          message: issue.message,
          questionNumber: issue.questionNumber,
          questionStem: issue.questionStem,
        }))}
        onBack={() => setScreen("bank")}
      />
    );
  }

  if (screen === "categories") {
    return (
      <ScopeListScreen
        kind="categories"
        items={activeBank.categories.map((category) => ({
          id: category.id,
          name: category.name,
          questionCount: category.questionIds.length,
        }))}
        onBack={() => setScreen("bank")}
        onSelect={(categoryId) => {
          const category = activeBank.categories.find(
            (item) => item.id === categoryId,
          );
          if (category) {
            openScope({
              kind: "category",
              id: category.id,
              name: category.name,
              questionIds: category.questionIds,
            });
          }
        }}
      />
    );
  }

  if (screen === "partitions") {
    return (
      <>
        <ScopeListScreen
          kind="partitions"
          items={activeUserState.partitions.map((partition) => ({
            id: partition.id,
            name: partition.name,
            questionCount: partition.questionIds.length,
          }))}
          onBack={() => setScreen("bank")}
          onSelect={(partitionId) => {
            const partition = activeUserState.partitions.find(
              (item) => item.id === partitionId,
            );
            if (partition) {
              openScope({
                kind: "partition",
                id: partition.id,
                name: partition.name,
                questionIds: partition.questionIds,
              });
            }
          }}
          onCreatePartition={() => {
            setEditingPartitionId(null);
            setScreen("partitionEditor");
          }}
          onCreateWithAi={() => {
            setEditingPartitionId(null);
            setAiIntent("");
            setAiIntentSummary(null);
            setAiIntentBusy(false);
            setAiIntentError(null);
            setAiCandidate(null);
            setAiProcessingError(null);
            setScreen("aiIntent");
          }}
          onEditPartition={(partitionId) => {
            setEditingPartitionId(partitionId);
            setScreen("partitionEditor");
          }}
          onDeletePartition={setPendingPartitionDeleteId}
        />
        {pendingPartitionDelete ? (
          <DeletePartitionConfirmDialog
            partitionName={pendingPartitionDelete.name}
            questionCount={pendingPartitionDelete.questionIds.length}
            onCancel={() => setPendingPartitionDeleteId(null)}
            onConfirm={confirmDeletePartition}
          />
        ) : null}
        {operationError ? (
          <OperationErrorDialog
            message={operationError}
            onClose={() => setOperationError(null)}
          />
        ) : null}
      </>
    );
  }

  if (screen === "partitionEditor") {
    return (
      <>
        <PartitionEditorScreen
          title={editingPartition
            ? t("quiz.partition.editTitle")
            : t("quiz.partition.createTitle")}
          initialName={editingPartition?.name}
          initialSelectedQuestionIds={editingPartition?.questionIds}
          questions={activeBank.questions.map((question) => ({
            id: question.id,
            number: question.number,
            typeLabel: questionTypeLabel(question.type, t),
            stem: question.stem,
          }))}
          onCancel={() => {
            setEditingPartitionId(null);
            setScreen("partitions");
          }}
          onSave={savePartition}
        />
        {operationError ? (
          <OperationErrorDialog
            message={operationError}
            onClose={() => setOperationError(null)}
          />
        ) : null}
      </>
    );
  }

  if (screen === "scope" && selectedScope) {
    return (
      <ScopePracticeScreen
        scopeName={selectedScope.name}
        questionCount={
          selectScopeQuestions(activeBank, selectedScope.questionIds).length
        }
        onBack={() => {
          if (selectedScope.kind === "category") {
            setScreen("categories");
          } else if (selectedScope.kind === "partition") {
            setScreen("partitions");
          } else {
            setScreen("bank");
          }
        }}
        onStartSequential={() =>
          startAttempt(
            activeBank.id,
            "practice",
            {
              shuffleQuestions: false,
              shuffleOptions: false,
            },
            selectedScope,
          )
        }
        onStartRandom={() =>
          startAttempt(
            activeBank.id,
            "practice",
            {
              shuffleQuestions: true,
              shuffleOptions: true,
            },
            selectedScope,
          )
        }
        onStartExam={() =>
          startAttempt(activeBank.id, "exam", {}, selectedScope)
        }
      />
    );
  }

  if (screen === "wrong") {
    const wrongQuestions = activeBank.questions.filter((question) =>
      activeUserState.wrongQuestionIds.includes(question.id)
    );
    const wrongScope: QuestionScope = {
      kind: "wrong",
      id: "wrong",
      name: t("quiz.scope.wrongQuestions"),
      questionIds: wrongQuestions.map((question) => question.id),
    };
    return (
      <WrongQuestionsScreen
        questions={wrongQuestions.map((question) => ({
          id: question.id,
          number: question.number,
          typeLabel: questionTypeLabel(question.type, t),
          stem: question.stem,
        }))}
        onBack={() => setScreen("bank")}
        onStartSequential={() =>
          startAttempt(
            activeBank.id,
            "practice",
            {
              shuffleQuestions: false,
              shuffleOptions: false,
            },
            wrongScope,
          )
        }
        onStartRandom={() =>
          startAttempt(
            activeBank.id,
            "practice",
            {
              shuffleQuestions: true,
              shuffleOptions: true,
            },
            wrongScope,
          )
        }
        onStartExam={() =>
          startAttempt(activeBank.id, "exam", {}, wrongScope)
        }
        onRemoveQuestion={removeWrongQuestion}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        shuffleQuestions={preferences.shuffleQuestions}
        shuffleOptions={preferences.shuffleOptions}
        onToggleQuestions={() =>
          setPreferences((current) => ({
            ...current,
            shuffleQuestions: !current.shuffleQuestions,
          }))
        }
        onToggleOptions={() =>
          setPreferences((current) => ({
            ...current,
            shuffleOptions: !current.shuffleOptions,
          }))
        }
        onBack={() => setScreen(settingsReturn)}
        onOpenLibrary={() => setScreen("home")}
        aiStatusLabel={
          aiConfiguration
            ? t("quiz.ai.status.configured")
            : aiConfigStatus === "testing"
              ? t("quiz.ai.status.testing")
              : aiConfigStatus === "error"
                ? t("quiz.ai.status.error")
                : t("quiz.ai.status.unconfigured")
        }
        onOpenModelApi={() => {
          setAiConfigReturn("settings");
          setScreen("modelApi");
        }}
      />
    );
  }

  if (screen === "modelApi") {
    return (
      <AiConfigScreen
        key={
          aiConfiguration
            ? `${aiConfiguration.apiBaseUrl}:${aiConfiguration.model}`
            : "unconfigured"
        }
        initialValue={{
          baseUrl: aiConfiguration?.apiBaseUrl ?? "",
          apiKey: aiConfiguration?.apiKey ?? "",
          model: aiConfiguration?.model ?? "",
        }}
        status={aiConfigStatus}
        statusMessage={aiConfigStatusMessage}
        isSaving={aiConfigAction === "saving"}
        isTesting={aiConfigAction === "testing"}
        isClearing={aiConfigAction === "clearing"}
        canClear={Boolean(aiConfiguration)}
        onBack={() => setScreen(aiConfigReturn)}
        onTestConnection={(value) => void handleTestAiConnection(value)}
        onSave={(value) => void handleSaveAiConfiguration(value)}
        onValueChange={() => {
          if (
            aiConfigStatus === "connected" ||
            aiConfigStatus === "error" ||
            aiConfigStatus === "saved"
          ) {
            setAiConfigStatus(aiConfiguration ? "saved" : "unconfigured");
            setAiConfigStatusMessage(
              aiConfiguration
                ? t("quiz.ai.configuration.formChangedSaved")
                : t("quiz.ai.configuration.formChangedUnsaved"),
            );
          }
        }}
        onClear={() => void handleClearAiConfiguration()}
      />
    );
  }

  if (screen === "aiIntent") {
    return (
      <AiPartitionIntentScreen
        bankName={activeBank.name}
        initialIntent={aiIntent}
        isConfigured={aiConfigured}
        isBusy={aiIntentBusy}
        errorMessage={aiIntentError ?? undefined}
        onBack={() => {
          aiIntentAbortControllerRef.current?.abort();
          aiIntentAbortControllerRef.current = null;
          aiIntentRunIdRef.current += 1;
          setAiIntentBusy(false);
          setAiIntentError(null);
          setScreen("partitions");
        }}
        onOpenSettings={() => {
          aiIntentAbortControllerRef.current?.abort();
          aiIntentAbortControllerRef.current = null;
          aiIntentRunIdRef.current += 1;
          setAiIntentBusy(false);
          setAiIntentError(null);
          setAiConfigReturn("aiIntent");
          setScreen("modelApi");
        }}
        onContinue={(intent) => void continueAiPartitionIntent(intent)}
      />
    );
  }

  if (screen === "aiConfirm" && aiIntentSummary) {
    return (
      <AiPartitionConfirmScreen
        bankName={activeBank.name}
        questionCount={activeBank.questions.length}
        intent={aiIntent}
        summary={aiIntentSummary.summary}
        suggestedPartitionName={aiIntentSummary.suggestedPartitionName}
        onBack={() => setScreen("aiIntent")}
        onStart={() => void runAiPartition()}
      />
    );
  }

  if (screen === "aiProcessing") {
    return (
      <AiPartitionProcessingScreen
        intent={aiIntent}
        questionCount={activeBank.questions.length}
        state={aiProcessingError ? "error" : "processing"}
        errorMessage={aiProcessingError ?? undefined}
        onCancel={() => {
          aiAbortControllerRef.current?.abort();
          aiAbortControllerRef.current = null;
          aiRunIdRef.current += 1;
          setAiProcessingError(null);
          setScreen("partitions");
        }}
        onRetry={() => void runAiPartition()}
      />
    );
  }

  if (screen === "aiReview" && aiCandidate) {
    return (
      <>
        <AiPartitionReviewScreen
          initialName={aiCandidate.name}
          intent={aiIntent}
          questions={activeBank.questions.map((question) => ({
            id: question.id,
            number: question.number,
            typeLabel: questionTypeLabel(question.type, t),
            stem: question.stem,
          }))}
          initialSelectedQuestionIds={aiCandidate.questionIds}
          note={t("quiz.ai.reviewNote", {
            reason: aiCandidate.reason,
            confidence: Math.round(aiCandidate.confidence * 100),
          })}
          onCancel={() => {
            setAiCandidate(null);
            setScreen("partitions");
          }}
          onRegenerate={() => void runAiPartition()}
          onSave={savePartition}
        />
        {operationError ? (
          <OperationErrorDialog
            message={operationError}
            onClose={() => setOperationError(null)}
          />
        ) : null}
      </>
    );
  }

  if (!session) {
    return (
      <main className="app-shell">
        <div className="empty-state">{t("quiz.restore.loading")}</div>
      </main>
    );
  }

  if (screen === "result") {
    const reviewQuestion = session.attempt.questions[session.reviewIndex];
    const reviewAnswer = session.answers[reviewQuestion.id];
    const reviewedCount = session.attempt.questions.length;

    return (
      <main className="app-shell result-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <button
              type="button"
              className="topbar-button"
              onClick={() => setScreen("bank")}
            >
              {t("quiz.navigation.library")}
            </button>
            <div className="topbar-title">
              {session.attempt.mode === "exam"
                ? t("quiz.result.examTitle")
                : t("quiz.result.practiceTitle")}
            </div>
            {session.attempt.mode === "exam" ? (
              <button
                type="button"
                className="topbar-button"
                onClick={() => setAnswerSheetOpen(true)}
              >
                {t("quiz.answerSheet.title")}
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </header>

        <div className="result-content">
          <section className="score-card" data-testid="score-card">
            <p className="score-eyebrow">
              {session.attempt.mode === "exam"
                ? t("quiz.result.examEyebrow")
                : t("quiz.result.practiceEyebrow")}
            </p>
            <p className="score-number">
              {score?.percentage ?? 0}<span>{t("quiz.result.points")}</span>
            </p>
            <div className="score-stats">
              <div className="score-stat">
                <strong>{score?.correct ?? 0}</strong>
                <span>{t("quiz.status.correct")}</span>
              </div>
              <div className="score-stat">
                <strong>{(score?.incorrect ?? 0) + (score?.unanswered ?? 0)}</strong>
                <span>{t("quiz.status.wrongOrUnansweredSlash")}</span>
              </div>
              <div className="score-stat">
                <strong>{score?.excluded ?? 0}</strong>
                <span>{t("quiz.status.excluded")}</span>
              </div>
            </div>
          </section>

          <div className="result-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                startAttempt(
                  session.bankId,
                  session.attempt.mode,
                  session.attempt.prefs,
                  session.scope,
                )
              }
            >
              {session.attempt.mode === "exam"
                ? t("quiz.result.retryExam")
                : t("quiz.result.retryPractice")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={returnToBank}
            >
              {t("quiz.navigation.backToLibrary")}
            </button>
          </div>

          {session.attempt.mode === "exam" ? (
            <section aria-labelledby="review-title">
              <div className="review-heading">
                <h2 id="review-title">{t("quiz.result.reviewTitle")}</h2>
                <span>{session.reviewIndex + 1} / {reviewedCount}</span>
              </div>
              <div className="question-meta">
                <div className="question-badges">
                  <span className="question-badge">
                    {questionTypeLabel(reviewQuestion.type, t)}
                  </span>
                  <span className="question-badge neutral">
                    {t("quiz.question.originalNumber", {
                      number: reviewQuestion.number,
                    })}
                  </span>
                </div>
              </div>
              <QuestionCard
                question={reviewQuestion}
                answer={reviewAnswer}
                revealed
                review
              />
              <div className="review-nav">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={session.reviewIndex === 0}
                  onClick={() =>
                    setSession((current) =>
                      current
                        ? { ...current, reviewIndex: current.reviewIndex - 1 }
                        : current,
                    )}
                >
                  {t("quiz.action.previousQuestion")}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={session.reviewIndex >= reviewedCount - 1}
                  onClick={() =>
                    setSession((current) =>
                      current
                        ? { ...current, reviewIndex: current.reviewIndex + 1 }
                        : current,
                    )}
                >
                  {t("quiz.action.nextQuestion")}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        {answerSheetOpen ? (
          <AnswerSheet
            session={session}
            currentIndex={session.reviewIndex}
            review
            onClose={() => setAnswerSheetOpen(false)}
            onSelect={(index) => {
              setSession((current) =>
                current ? { ...current, reviewIndex: index } : current,
              );
              setAnswerSheetOpen(false);
            }}
          />
        ) : null}
      </main>
    );
  }

  const currentQuestion = session.attempt.questions[session.cursor];
  const currentAnswer = session.answers[currentQuestion.id];
  const isPractice = session.attempt.mode === "practice";
  const revealed = session.revealed.includes(currentQuestion.id);
  const currentAnswered = hasAnswer(currentQuestion, currentAnswer);
  const isLast = session.cursor >= session.attempt.questions.length - 1;
  const unansweredCount = session.attempt.questions.filter(
    (question) => !hasAnswer(question, session.answers[question.id]),
  ).length;

  return (
    <main className="app-shell quiz-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="topbar-button"
            onClick={() => setScreen("bank")}
          >
            {t("quiz.navigation.library")}
          </button>
          <div className="topbar-title">
            {isPractice
              ? session.attempt.prefs.shuffleQuestions
                ? t("quiz.mode.randomPractice")
                : t("quiz.mode.sequentialPractice")
              : t("quiz.mode.exam")}
          </div>
          <button
            type="button"
            className="topbar-button"
            onClick={() => setAnswerSheetOpen(true)}
            data-testid="open-answer-sheet"
          >
            {t("quiz.answerSheet.title")}
          </button>
        </div>
        <div className="progress-line" aria-hidden="true">
          <div
            className="progress-value"
            style={{
              width: `${((session.cursor + 1) / session.attempt.questions.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <div className="quiz-content">
        <div className="question-meta">
          <div className="question-badges">
            <span className="question-badge">
              {questionTypeLabel(currentQuestion.type, t)}
            </span>
            <span className="question-badge neutral">
              {t("quiz.question.originalNumber", {
                number: currentQuestion.number,
              })}
            </span>
          </div>
          <span className="question-position">
            <strong>{session.cursor + 1}</strong> / {session.attempt.questions.length}
          </span>
        </div>

        <QuestionCard
          question={currentQuestion}
          answer={currentAnswer}
          revealed={isPractice && revealed}
          onOption={selectOption}
          onText={updateFillAnswer}
        />
      </div>

      <footer className="bottom-bar">
        <div className="bottom-bar-inner">
          <button
            type="button"
            className="secondary-button"
            disabled={session.cursor === 0}
            onClick={() =>
              setSession((current) =>
                current ? { ...current, cursor: current.cursor - 1 } : current,
              )}
          >
            {t("quiz.action.previousQuestion")}
          </button>

          {isPractice ? (
            revealed ? (
              <button
                type="button"
                className="primary-button"
                onClick={goNextPractice}
                data-testid="practice-next"
              >
                {isLast
                  ? t("quiz.action.finishPractice")
                  : t("quiz.action.nextQuestion")}
              </button>
            ) : currentQuestion.type === "multiple" || currentQuestion.type === "fill" ? (
              <button
                type="button"
                className="primary-button"
                disabled={!currentAnswered}
                onClick={confirmPracticeAnswer}
                data-testid="confirm-practice-answer"
              >
                {t("quiz.action.confirmAnswer")}
              </button>
            ) : (
              <button type="button" className="primary-button" disabled>
                {t("quiz.action.selectAnswer")}
              </button>
            )
          ) : isLast ? (
            <button
              type="button"
              className="primary-button finish"
              onClick={() => setSubmitDialogOpen(true)}
              data-testid="submit-exam"
            >
              {t("quiz.action.submit")}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setSession((current) =>
                  current ? { ...current, cursor: current.cursor + 1 } : current,
                )}
              data-testid="exam-next"
            >
              {t("quiz.action.nextQuestion")}
            </button>
          )}
        </div>
      </footer>

      {answerSheetOpen ? (
        <AnswerSheet
          session={session}
          currentIndex={session.cursor}
          onClose={() => setAnswerSheetOpen(false)}
          onSubmit={
            isPractice
              ? undefined
              : () => {
                  setAnswerSheetOpen(false);
                  setSubmitDialogOpen(true);
                }
          }
          onSelect={(index) => {
            setSession((current) =>
              current ? { ...current, cursor: index } : current,
            );
            setAnswerSheetOpen(false);
          }}
        />
      ) : null}

      {submitDialogOpen ? (
        <SubmitDialog
          unanswered={unansweredCount}
          onCancel={() => setSubmitDialogOpen(false)}
          onSubmit={submitExam}
        />
      ) : null}
    </main>
  );
}
