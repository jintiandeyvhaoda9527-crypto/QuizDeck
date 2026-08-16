"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  filterAiModels,
  isModelMissingFromUpstream,
  type AiModel,
  type AiModelDiscoveryResult,
} from "./ai-model-discovery";
import {
  AI_PROVIDER_DEFINITIONS,
  DEFAULT_AI_PROVIDER_ID,
  getAiProviderDefinition,
} from "./ai-providers";
import { useI18n } from "./i18n";

export interface SessionSummary {
  answered: number;
  total: number;
  percentage: number;
  label: string;
  submitted: boolean;
  score?: number;
}

export interface LibraryBankSummary {
  id: string;
  name: string;
  questionCount: number;
  gradableCount: number;
  session: SessionSummary | null;
}

export interface LibraryHomeProps {
  banks: LibraryBankSummary[];
  onOpenBank: (bankId: string) => void;
  onPrimaryAction: (bankId: string) => void;
  onImportFile: (file: File) => void;
  onOpenSettings: () => void;
}

export interface QuestionTypeCounts {
  single: number;
  multiple: number;
  judge: number;
  fill: number;
}

export interface BankDetailProps {
  bankName: string;
  isImported?: boolean;
  questionCount: number;
  gradableCount: number;
  typeCounts: QuestionTypeCounts;
  categoryCount: number;
  partitionCount: number;
  wrongCount: number;
  session: SessionSummary | null;
  onBack: () => void;
  onResume: () => void;
  onStartSequential: () => void;
  onStartRandom: () => void;
  onStartExam: () => void;
  onOpenAllQuestions: () => void;
  onOpenCategories: () => void;
  onOpenPartitions: () => void;
  onOpenWrongQuestions: () => void;
  onOpenSettings: () => void;
  importIssueCount?: number;
  onOpenImportIssues?: () => void;
  onRenameBank?: () => void;
  onDeleteBank?: () => void;
}

export interface ImportResultSheetProps {
  initialName: string;
  questionCount: number;
  categoryCount: number;
  issueCount: number;
  issueSummary?: string;
  duplicateBankName?: string;
  duplicateWarning?: string;
  onSave: (bankName: string) => void;
  onCancel: () => void;
}

export type ScopeListKind = "categories" | "partitions";

export interface ScopeListItem {
  id: string;
  name: string;
  questionCount: number;
}

export interface ScopeListScreenProps {
  kind: ScopeListKind;
  items: ScopeListItem[];
  onBack: () => void;
  onSelect: (scopeId: string) => void;
  onCreatePartition?: () => void;
  onCreateWithAi?: () => void;
  onEditPartition?: (scopeId: string) => void;
  onDeletePartition?: (scopeId: string) => void;
}

export interface ScopePracticeScreenProps {
  scopeName: string;
  questionCount: number;
  onBack: () => void;
  onStartSequential: () => void;
  onStartRandom: () => void;
  onStartExam: () => void;
}

export interface PartitionQuestionItem {
  id: string;
  number?: number;
  typeLabel?: string;
  stem: string;
}

export interface PartitionEditorScreenProps {
  title?: string;
  initialName?: string;
  questions: PartitionQuestionItem[];
  initialSelectedQuestionIds?: string[];
  onCancel: () => void;
  onSave: (name: string, selectedQuestionIds: string[]) => void;
}

export interface WrongQuestionItem {
  id: string;
  number?: number;
  typeLabel?: string;
  stem: string;
}

export interface WrongQuestionsScreenProps {
  questions: WrongQuestionItem[];
  onBack: () => void;
  onStartSequential: () => void;
  onStartRandom: () => void;
  onStartExam: () => void;
  onRemoveQuestion: (questionId: string) => void;
}

export interface SettingsScreenProps {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  onToggleQuestions: () => void;
  onToggleOptions: () => void;
  onBack: () => void;
  onOpenLibrary: () => void;
  onOpenModelApi: () => void;
  aiStatusLabel?: string;
}

export interface ImportIssueListItem {
  id: string;
  code?: string;
  severity: "warning" | "error";
  message: string;
  questionNumber?: number;
  questionStem?: string;
}

export interface ImportIssueDetailsScreenProps {
  bankName: string;
  sourceFileName?: string;
  issues: ImportIssueListItem[];
  onBack: () => void;
}

export interface RenameBankSheetProps {
  currentName: string;
  onCancel: () => void;
  onSave: (bankName: string) => void;
}

export interface DeleteBankConfirmDialogProps {
  bankName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface DeletePartitionConfirmDialogProps {
  partitionName: string;
  questionCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export type AiConnectionStatus =
  | "unconfigured"
  | "saved"
  | "changed"
  | "discovering"
  | "testing"
  | "connected"
  | "error";

export interface AiConfigValue {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  detectedAt?: number;
}

export interface AiConfigScreenProps {
  initialValue: AiConfigValue;
  status?: AiConnectionStatus;
  statusMessage?: string;
  isDiscovering?: boolean;
  isSaving?: boolean;
  isTesting?: boolean;
  isClearing?: boolean;
  canClear?: boolean;
  keyStorageSecurity?: "secure" | "web-preview" | "memory";
  onBack: () => void;
  onDiscoverModels: (
    value: AiConfigValue,
  ) => Promise<AiModelDiscoveryResult | null>;
  onTestConnection: (value: AiConfigValue) => void;
  onSave: (value: AiConfigValue) => void;
  onValueChange?: () => void;
  onClear?: () => void | Promise<void>;
}

const AI_CONFIG_STATUS_ID = "ai-config-connection-status";

export interface AiPartitionIntentScreenProps {
  bankName: string;
  initialIntent?: string;
  isConfigured: boolean;
  isBusy?: boolean;
  errorMessage?: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onContinue: (intent: string) => void;
}

export interface AiPartitionConfirmScreenProps {
  bankName: string;
  questionCount: number;
  intent: string;
  summary?: string;
  suggestedPartitionName?: string;
  onBack: () => void;
  onStart: () => void;
}

export interface AiPartitionProcessingScreenProps {
  intent: string;
  questionCount?: number;
  state?: "processing" | "error";
  errorMessage?: string;
  onCancel?: () => void;
  onRetry?: () => void;
}

export interface AiPartitionReviewScreenProps {
  initialName: string;
  intent: string;
  questions: PartitionQuestionItem[];
  initialSelectedQuestionIds: string[];
  note?: string;
  onCancel: () => void;
  onRegenerate: () => void;
  onSave: (name: string, selectedQuestionIds: string[]) => void;
}

type Translate = ReturnType<typeof useI18n>["t"];
type CountKind = "bank" | "category" | "partition" | "question" | "issue";

function countLabel(t: Translate, kind: CountKind, count: number) {
  const plurality = count === 1 ? "one" : "other";
  return t(`library.count.${kind}.${plurality}`, { count });
}

function BottomNavigation({
  active,
  onLibrary,
  onSettings,
}: {
  active: "library" | "settings";
  onLibrary: () => void;
  onSettings: () => void;
}) {
  const { t } = useI18n();

  return (
    <nav
      className="library-bottom-nav"
      aria-label={t("library.navigation.label")}
    >
      <div className="library-bottom-nav-inner">
        <button
          type="button"
          className={active === "library" ? "active" : ""}
          aria-current={active === "library" ? "page" : undefined}
          onClick={onLibrary}
        >
          <span className="nav-dot" aria-hidden="true" />
          {t("library.navigation.library")}
        </button>
        <button
          type="button"
          className={active === "settings" ? "active" : ""}
          aria-current={active === "settings" ? "page" : undefined}
          onClick={onSettings}
        >
          <span className="nav-dot" aria-hidden="true" />
          {t("library.navigation.settings")}
        </button>
      </div>
    </nav>
  );
}

function ProgressBar({ value }: { value: number }) {
  const { t } = useI18n();
  const progress = Math.min(100, Math.max(0, value));

  return (
    <div
      className="bank-progress-track"
      role="progressbar"
      aria-label={t("library.progress.label")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}

function ScopeRow({
  symbol,
  title,
  detail,
  disabled = false,
  onClick,
}: {
  symbol: string;
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="scope-list-row"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="scope-icon" aria-hidden="true">{symbol}</span>
      <span className="scope-row-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      {disabled ? null : (
        <span className="chevron" aria-hidden="true">›</span>
      )}
    </button>
  );
}

function PartitionQuestionChecklist({
  questions,
  selectedQuestionIds,
  onToggle,
}: {
  questions: PartitionQuestionItem[];
  selectedQuestionIds: Set<string>;
  onToggle: (questionId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="partition-question-list">
      {questions.map((question) => {
        const checked = selectedQuestionIds.has(question.id);
        const metadata = [
          question.number
            ? t("library.question.original", { number: question.number })
            : "",
          question.typeLabel ?? "",
        ].filter(Boolean).join(" · ");

        return (
          <label
            className={`partition-question-row ${checked ? "selected" : ""}`}
            key={question.id}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(question.id)}
            />
            <span>
              {metadata ? <small>{metadata}</small> : null}
              <strong>{question.stem}</strong>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function LibraryHome({
  banks,
  onOpenBank,
  onPrimaryAction,
  onImportFile,
  onOpenSettings,
}: LibraryHomeProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      onImportFile(file);
    }
    event.currentTarget.value = "";
  };

  return (
    <main className="app-shell library-shell">
      <div className="library-page">
        <header className="library-header">
          <div>
            <p className="page-kicker">{t("library.home.kicker")}</p>
            <h1>QuizDeck</h1>
          </div>
          <button
            type="button"
            className="header-action"
            onClick={() => fileInputRef.current?.click()}
            data-testid="import-bank"
          >
            {t("library.home.import")}
          </button>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            data-testid="import-bank-input"
          />
        </header>

        <section className="library-section" aria-labelledby="bank-list-title">
          <div className="section-heading">
            <h2 id="bank-list-title">{t("library.home.allBanks")}</h2>
            <span>{countLabel(t, "bank", banks.length)}</span>
          </div>

          {banks.length > 0 ? (
            <div className="library-bank-list">
              {banks.map((bank) => {
                const progress = bank.session?.percentage ?? 0;
                const primaryLabel = bank.session
                  ? bank.session.submitted
                    ? t("library.home.viewLastResult")
                    : t("library.home.continuePractice")
                  : t("library.home.startPractice");

                return (
                  <article className="library-bank-card" key={bank.id}>
                    <button
                      type="button"
                      className="bank-card-heading"
                      onClick={() => onOpenBank(bank.id)}
                      data-testid={`open-bank-${bank.id}`}
                    >
                      <span className="bank-card-icon" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="bank-card-copy">
                        <strong>{bank.name}</strong>
                        <span>
                          {t("library.home.bankMeta", {
                            questions: countLabel(
                              t,
                              "question",
                              bank.questionCount,
                            ),
                            gradable: bank.gradableCount,
                          })}
                        </span>
                      </span>
                      <span className="chevron" aria-hidden="true">›</span>
                    </button>

                    <div className="bank-progress-copy">
                      <span>
                        {bank.session
                          ? t("library.home.answered", {
                              answered: bank.session.answered,
                              total: bank.session.total,
                            })
                          : t("library.home.notStarted")}
                      </span>
                      <strong>{progress}%</strong>
                    </div>
                    <ProgressBar value={progress} />

                    <button
                      type="button"
                      className="bank-primary-action"
                      onClick={() => onPrimaryAction(bank.id)}
                      data-testid={`bank-primary-action-${bank.id}`}
                    >
                      {primaryLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="library-empty-card">
              <strong>{t("library.home.emptyTitle")}</strong>
              <span>{t("library.home.emptyDescription")}</span>
            </div>
          )}
        </section>
      </div>

      <BottomNavigation
        active="library"
        onLibrary={() => undefined}
        onSettings={onOpenSettings}
      />
    </main>
  );
}

export function BankDetail({
  bankName,
  isImported = false,
  questionCount,
  gradableCount,
  typeCounts,
  categoryCount,
  partitionCount,
  wrongCount,
  session,
  onBack,
  onResume,
  onStartSequential,
  onStartRandom,
  onStartExam,
  onOpenAllQuestions,
  onOpenCategories,
  onOpenPartitions,
  onOpenWrongQuestions,
  onOpenSettings,
  importIssueCount = 0,
  onOpenImportIssues,
  onRenameBank,
  onDeleteBank,
}: BankDetailProps) {
  const { t } = useI18n();
  const progress = session?.percentage ?? 0;

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.detail.title")}</h1>
          <button
            type="button"
            className="detail-settings-action"
            onClick={onOpenSettings}
          >
            {t("library.common.settings")}
          </button>
        </header>

        <section className="bank-overview">
          <h2>{bankName}</h2>
          <p>
            {session
              ? t("library.detail.overviewAnswered", {
                  questions: countLabel(t, "question", questionCount),
                  answered: session.answered,
                })
              : countLabel(t, "question", questionCount)}
          </p>
          <div className="overview-progress-copy">
            <span>{t("library.progress.label")}</span>
            <strong>{progress}%</strong>
          </div>
          <ProgressBar value={progress} />

          {session ? (
            <button
              type="button"
              className="bank-primary-action"
              onClick={onResume}
              data-testid="resume-attempt"
            >
              {session.submitted
                ? t("library.home.viewLastResult")
                : t("library.home.continuePractice")}
            </button>
          ) : null}
        </section>

        <section className="mode-section" aria-labelledby="mode-title">
          <div className="section-heading">
            <h2 id="mode-title">{t("library.modes.title")}</h2>
          </div>

          <button
            type="button"
            className="mode-featured"
            onClick={onStartSequential}
            data-testid="start-sequential"
          >
            <span className="mode-symbol" aria-hidden="true">
              {t("library.modes.sequentialSymbol")}
            </span>
            <span>
              <strong>{t("library.modes.sequential")}</strong>
              <small>{t("library.modes.sequentialDescription")}</small>
            </span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>

          <div className="secondary-mode-grid">
            <button
              type="button"
              className="secondary-mode-card"
              onClick={onStartRandom}
              data-testid="start-practice"
            >
              <span className="secondary-mode-symbol" aria-hidden="true">
                {t("library.modes.randomSymbol")}
              </span>
              <span>
                <strong>{t("library.modes.random")}</strong>
                <small>{t("library.modes.randomDescription")}</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-mode-card exam"
              onClick={onStartExam}
              data-testid="start-exam"
            >
              <span className="secondary-mode-symbol" aria-hidden="true">
                {t("library.modes.examSymbol")}
              </span>
              <span>
                <strong>{t("library.modes.exam")}</strong>
                <small>{t("library.modes.examDescription")}</small>
              </span>
            </button>
          </div>
        </section>

        <section className="scope-section" aria-labelledby="scope-title">
          <div className="section-heading">
            <h2 id="scope-title">{t("library.scope.title")}</h2>
          </div>
          <div className="scope-card scope-list-card">
            <ScopeRow
              symbol={t("library.scope.allSymbol")}
              title={t("library.scope.all")}
              detail={t("library.scope.allDetail", {
                questions: countLabel(t, "question", questionCount),
                gradable: gradableCount,
              })}
              onClick={onOpenAllQuestions}
            />
            <div
              className="type-counts scope-type-counts"
              aria-label={t("library.scope.typeStats")}
            >
              <span>{t("library.scope.single", { count: typeCounts.single })}</span>
              <span>{t("library.scope.multiple", { count: typeCounts.multiple })}</span>
              <span>{t("library.scope.judge", { count: typeCounts.judge })}</span>
              <span>{t("library.scope.fill", { count: typeCounts.fill })}</span>
            </div>
            <ScopeRow
              symbol={t("library.scope.categorySymbol")}
              title={t("library.scope.categories")}
              detail={categoryCount > 0
                ? countLabel(t, "category", categoryCount)
                : t("library.scope.noCategories")}
              disabled={categoryCount === 0}
              onClick={onOpenCategories}
            />
            <ScopeRow
              symbol={t("library.scope.partitionSymbol")}
              title={t("library.scope.partitions")}
              detail={partitionCount > 0
                ? countLabel(t, "partition", partitionCount)
                : t("library.scope.noPartitions")}
              onClick={onOpenPartitions}
            />
            <ScopeRow
              symbol={t("library.scope.wrongSymbol")}
              title={t("library.scope.wrong")}
              detail={wrongCount > 0
                ? countLabel(t, "question", wrongCount)
                : t("library.scope.noWrong")}
              disabled={wrongCount === 0}
              onClick={onOpenWrongQuestions}
            />
          </div>
        </section>

        <p className="bank-note">
          {t("library.detail.sourceNote")}
        </p>

        {isImported || onDeleteBank ? (
          <section
            className="settings-group bank-management-section"
            aria-labelledby="bank-management-title"
          >
            <div className="section-heading">
              <h2 id="bank-management-title">{t("library.management.title")}</h2>
              <span>{t("library.management.kicker")}</span>
            </div>
            <div className="settings-card settings-link-card">
              {onOpenImportIssues ? (
                <button
                  type="button"
                  className="setting-link-row"
                  onClick={onOpenImportIssues}
                >
                  <span className="setting-copy">
                    <strong>{t("library.management.importIssues")}</strong>
                    <span>
                      {importIssueCount > 0
                        ? t("library.management.issuesToReview", {
                            count: importIssueCount,
                          })
                        : t("library.management.noStructuralIssues")}
                    </span>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              ) : null}
              {onRenameBank ? (
                <button
                  type="button"
                  className="setting-link-row"
                  onClick={onRenameBank}
                >
                  <span className="setting-copy">
                    <strong>{t("library.management.rename")}</strong>
                    <span>{t("library.management.renameDescription")}</span>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              ) : null}
              {onDeleteBank ? (
                <button
                  type="button"
                  className="setting-link-row danger-link-row"
                  onClick={onDeleteBank}
                >
                  <span className="setting-copy">
                    <strong>{t("library.management.delete")}</strong>
                    <span>{t("library.management.deleteDescription")}</span>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export function ImportResultSheet({
  initialName,
  questionCount,
  categoryCount,
  issueCount,
  issueSummary,
  duplicateBankName,
  duplicateWarning,
  onSave,
  onCancel,
}: ImportResultSheetProps) {
  const { t } = useI18n();
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const normalizedName = name.trim();

  return (
    <div className="sheet-backdrop">
      <section
        className="bottom-sheet has-submit import-result-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-result-title"
      >
        <header className="sheet-header">
          <h2 id="import-result-title">{t("library.import.title")}</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label={t("library.import.cancelAria")}
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="sheet-body">
          <label className="field-label" htmlFor={inputId}>
            {t("library.import.bankName")}
          </label>
          <input
            id={inputId}
            className="text-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />

          <div
            className="import-summary"
            aria-label={t("library.import.summaryAria")}
          >
            <div>
              <span>{t("library.import.questions")}</span>
              <strong>{countLabel(t, "question", questionCount)}</strong>
            </div>
            <div>
              <span>{t("library.import.categories")}</span>
              <strong>
                {categoryCount > 0
                  ? countLabel(t, "category", categoryCount)
                  : t("library.import.notIncluded")}
              </strong>
            </div>
            <div>
              <span>{t("library.import.structuralIssues")}</span>
              <strong className={issueCount > 0 ? "has-issues" : ""}>
                {countLabel(t, "issue", issueCount)}
              </strong>
            </div>
          </div>

          <p className="import-issue-summary">
            {issueSummary
              ?? (issueCount > 0
                ? t("library.import.issueSummary", { count: issueCount })
                : t("library.import.noIssueSummary"))}
          </p>

          {duplicateBankName || duplicateWarning ? (
            <div className="duplicate-import-warning" role="status">
              <span aria-hidden="true">!</span>
              <div>
                <strong>{t("library.import.possibleDuplicate")}</strong>
                <p>
                  {duplicateWarning
                    ?? t("library.import.duplicateWarning", {
                      name: duplicateBankName ?? "",
                    })}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <footer className="sheet-submit-bar import-sheet-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            {t("library.common.cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!normalizedName}
            onClick={() => onSave(normalizedName)}
          >
            {t("library.import.saveAndOpen")}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function ImportIssueDetailsScreen({
  bankName,
  sourceFileName,
  issues,
  onBack,
}: ImportIssueDetailsScreenProps) {
  const { t } = useI18n();
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.importIssues.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="bank-overview import-issue-overview">
          <h2>{countLabel(t, "issue", issues.length)}</h2>
          <p>
            {errorCount > 0
              ? t("library.importIssues.affectsGrading", { count: errorCount })
              : t("library.importIssues.nonBlocking")}
          </p>
        </section>

        <section
          className="import-issue-section"
          aria-labelledby="import-issue-list-title"
        >
          <div className="section-heading">
            <h2 id="import-issue-list-title">{bankName}</h2>
            <span>{sourceFileName ?? t("library.importIssues.importedBank")}</span>
          </div>
          {issues.length > 0 ? (
            <div className="import-issue-list">
              {issues.map((issue) => (
                <article
                  className={`import-issue-row ${issue.severity}`}
                  key={issue.id}
                >
                  <span className="issue-state" aria-hidden="true">
                    {issue.severity === "error" ? "!" : "i"}
                  </span>
                  <div>
                    <small>
                      {issue.questionNumber
                        ? t("library.question.original", {
                            number: issue.questionNumber,
                          })
                        : t("library.importIssues.fileStructure")}
                      {issue.code ? ` · ${issue.code}` : ""}
                    </small>
                    <strong>{issue.message}</strong>
                    {issue.questionStem ? (
                      <p className="import-issue-question">
                        {issue.questionStem}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="scope-empty-card">
              <strong>{t("library.importIssues.emptyTitle")}</strong>
              <span>{t("library.importIssues.emptyDescription")}</span>
            </div>
          )}
        </section>

        <p className="bank-note">
          {t("library.importIssues.sourceNote")}
        </p>
      </div>
    </main>
  );
}

export function RenameBankSheet({
  currentName,
  onCancel,
  onSave,
}: RenameBankSheetProps) {
  const { t } = useI18n();
  const inputId = useId();
  const [name, setName] = useState(currentName);
  const normalizedName = name.trim();

  return (
    <div className="sheet-backdrop">
      <section
        className="bottom-sheet has-submit compact-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-bank-title"
      >
        <header className="sheet-header">
          <h2 id="rename-bank-title">{t("library.rename.title")}</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label={t("library.rename.cancelAria")}
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="sheet-body">
          <label className="field-label" htmlFor={inputId}>
            {t("library.import.bankName")}
          </label>
          <input
            id={inputId}
            className="text-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <footer className="sheet-submit-bar import-sheet-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t("library.common.cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!normalizedName || normalizedName === currentName.trim()}
            onClick={() => onSave(normalizedName)}
          >
            {t("library.common.save")}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function DeleteBankConfirmDialog({
  bankName,
  onCancel,
  onConfirm,
}: DeleteBankConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <div className="sheet-backdrop">
      <section
        className="modal-card destructive-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-bank-title"
        aria-describedby="delete-bank-description"
      >
        <span className="destructive-dialog-symbol" aria-hidden="true">
          {t("library.deleteBank.symbol")}
        </span>
        <h2 id="delete-bank-title">
          {t("library.deleteBank.title", { name: bankName })}
        </h2>
        <p id="delete-bank-description">
          {t("library.deleteBank.description")}
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t("library.common.cancel")}
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            onClick={onConfirm}
          >
            {t("library.common.delete")}
          </button>
        </div>
      </section>
    </div>
  );
}

export function DeletePartitionConfirmDialog({
  partitionName,
  questionCount,
  onCancel,
  onConfirm,
}: DeletePartitionConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <div className="sheet-backdrop">
      <section
        className="modal-card destructive-dialog compact-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-partition-title"
        aria-describedby="delete-partition-description"
      >
        <span className="destructive-dialog-symbol" aria-hidden="true">
          {t("library.deleteBank.symbol")}
        </span>
        <h2 id="delete-partition-title">
          {t("library.deletePartition.title", { name: partitionName })}
        </h2>
        <p id="delete-partition-description">
          {t("library.deletePartition.description", { count: questionCount })}
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t("library.common.cancel")}
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            onClick={onConfirm}
          >
            {t("library.deletePartition.confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ScopeListScreen({
  kind,
  items,
  onBack,
  onSelect,
  onCreatePartition,
  onCreateWithAi,
  onEditPartition,
  onDeletePartition,
}: ScopeListScreenProps) {
  const { t } = useI18n();
  const isPartitions = kind === "partitions";
  const title = isPartitions
    ? t("library.scopeList.partitions")
    : t("library.scopeList.categories");
  const emptyText = isPartitions
    ? t("library.scopeList.emptyPartitions")
    : t("library.scopeList.emptyCategories");

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{title}</h1>
          {isPartitions && onCreatePartition ? (
            <button
              type="button"
              className="detail-settings-action"
              onClick={onCreatePartition}
            >
              {t("library.scopeList.create")}
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </header>

        {isPartitions && onCreateWithAi ? (
          <section
            className="ai-create-callout"
            aria-label={t("library.scopeList.aiAria")}
          >
            <span className="ai-spark" aria-hidden="true">AI</span>
            <span>
              <strong>{t("library.scopeList.aiTitle")}</strong>
              <small>{t("library.scopeList.aiDescription")}</small>
            </span>
            <button type="button" onClick={onCreateWithAi}>
              {t("library.scopeList.aiCreate")}
            </button>
          </section>
        ) : null}

        <section aria-labelledby="scope-list-title">
          <div className="section-heading">
            <h2 id="scope-list-title">{title}</h2>
            <span>
              {countLabel(
                t,
                isPartitions ? "partition" : "category",
                items.length,
              )}
            </span>
          </div>
          {items.length > 0 ? (
            <div className="scope-directory-card">
              {items.map((item) => {
                if (isPartitions && (onEditPartition || onDeletePartition)) {
                  return (
                    <article
                      className="scope-directory-row partition-directory-row"
                      key={item.id}
                    >
                      <button
                        type="button"
                        className="scope-directory-main"
                        onClick={() => onSelect(item.id)}
                      >
                        <span className="scope-icon" aria-hidden="true">
                          {t("library.scope.partitionSymbol")}
                        </span>
                        <span className="scope-directory-copy">
                          <strong>{item.name}</strong>
                          <small>
                            {countLabel(t, "question", item.questionCount)}
                          </small>
                        </span>
                        <span className="chevron" aria-hidden="true">›</span>
                      </button>
                      <span className="partition-row-actions">
                        {onEditPartition ? (
                          <button
                            type="button"
                            onClick={() => onEditPartition(item.id)}
                            aria-label={t("library.scopeList.editAria", {
                              name: item.name,
                            })}
                          >
                            {t("library.common.edit")}
                          </button>
                        ) : null}
                        {onDeletePartition ? (
                          <button
                            type="button"
                            className="danger-text-button"
                            onClick={() => onDeletePartition(item.id)}
                            aria-label={t("library.scopeList.deleteAria", {
                              name: item.name,
                            })}
                          >
                            {t("library.common.delete")}
                          </button>
                        ) : null}
                      </span>
                    </article>
                  );
                }

                return (
                  <button
                    type="button"
                    className="scope-directory-row"
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                  >
                    <span className="scope-icon" aria-hidden="true">
                      {isPartitions
                        ? t("library.scope.partitionSymbol")
                        : t("library.scope.categorySymbol")}
                    </span>
                    <span className="scope-directory-copy">
                      <strong>{item.name}</strong>
                      <small>{countLabel(t, "question", item.questionCount)}</small>
                    </span>
                    <span className="chevron" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="scope-empty-card">{emptyText}</div>
          )}
        </section>
      </div>
    </main>
  );
}

export function ScopePracticeScreen({
  scopeName,
  questionCount,
  onBack,
  onStartSequential,
  onStartRandom,
  onStartExam,
}: ScopePracticeScreenProps) {
  const { t } = useI18n();

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.scopePractice.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="bank-overview scope-practice-overview">
          <span className="scope-icon" aria-hidden="true">
            {t("library.scopePractice.symbol")}
          </span>
          <div>
            <h2>{scopeName}</h2>
            <p>{countLabel(t, "question", questionCount)}</p>
          </div>
        </section>

        <section className="mode-section" aria-labelledby="scope-mode-title">
          <div className="section-heading">
            <h2 id="scope-mode-title">{t("library.modes.title")}</h2>
          </div>
          <button
            type="button"
            className="mode-featured"
            onClick={onStartSequential}
          >
            <span className="mode-symbol" aria-hidden="true">
              {t("library.modes.sequentialSymbol")}
            </span>
            <span>
              <strong>{t("library.modes.sequential")}</strong>
              <small>{t("library.scopePractice.sequentialDescription")}</small>
            </span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <div className="secondary-mode-grid">
            <button
              type="button"
              className="secondary-mode-card"
              onClick={onStartRandom}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">
                {t("library.modes.randomSymbol")}
              </span>
              <span>
                <strong>{t("library.modes.random")}</strong>
                <small>{t("library.scopePractice.randomDescription")}</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-mode-card exam"
              onClick={onStartExam}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">
                {t("library.modes.examSymbol")}
              </span>
              <span>
                <strong>{t("library.modes.exam")}</strong>
                <small>{t("library.modes.examDescription")}</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PartitionEditorScreen({
  title,
  initialName = "",
  questions,
  initialSelectedQuestionIds = [],
  onCancel,
  onSave,
}: PartitionEditorScreenProps) {
  const { t } = useI18n();
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(
    () => new Set(initialSelectedQuestionIds),
  );

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const normalizedName = name.trim();
  const canSave = normalizedName.length > 0 && selectedQuestionIds.size > 0;

  return (
    <main className="app-shell library-shell detail-shell partition-editor-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onCancel}>
            <span aria-hidden="true">‹</span>
            {t("library.partitionEditor.cancel")}
          </button>
          <h1>{title ?? t("library.partitionEditor.defaultTitle")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="editor-name-card">
          <label className="field-label" htmlFor={inputId}>
            {t("library.partitionEditor.name")}
          </label>
          <input
            id={inputId}
            className="text-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </section>

        <section className="partition-question-section" aria-labelledby="question-select-title">
          <div className="section-heading">
            <h2 id="question-select-title">
              {t("library.partitionEditor.selectQuestions")}
            </h2>
            <span>
              {t("library.partitionEditor.selected", {
                count: selectedQuestionIds.size,
              })}
            </span>
          </div>
          <PartitionQuestionChecklist
            questions={questions}
            selectedQuestionIds={selectedQuestionIds}
            onToggle={toggleQuestion}
          />
        </section>
      </div>

      <footer className="editor-action-bar">
        <div className="editor-action-bar-inner">
          <span>
            {t("library.partitionEditor.selected", {
              count: selectedQuestionIds.size,
            })}
          </span>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(
              normalizedName,
              Array.from(selectedQuestionIds),
            )}
          >
            {t("library.common.save")}
          </button>
        </div>
      </footer>
    </main>
  );
}

export function WrongQuestionsScreen({
  questions,
  onBack,
  onStartSequential,
  onStartRandom,
  onStartExam,
  onRemoveQuestion,
}: WrongQuestionsScreenProps) {
  const { t } = useI18n();
  const hasQuestions = questions.length > 0;

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.wrong.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="bank-overview wrong-overview">
          <h2>{countLabel(t, "question", questions.length)}</h2>
          <p>{t("library.wrong.removeDescription")}</p>
        </section>

        <section className="mode-section" aria-labelledby="wrong-mode-title">
          <div className="section-heading">
            <h2 id="wrong-mode-title">{t("library.modes.title")}</h2>
          </div>
          <button
            type="button"
            className="mode-featured"
            disabled={!hasQuestions}
            onClick={onStartSequential}
          >
            <span className="mode-symbol" aria-hidden="true">
              {t("library.modes.sequentialSymbol")}
            </span>
            <span>
              <strong>{t("library.modes.sequential")}</strong>
              <small>{t("library.wrong.sequentialDescription")}</small>
            </span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <div className="secondary-mode-grid">
            <button
              type="button"
              className="secondary-mode-card"
              disabled={!hasQuestions}
              onClick={onStartRandom}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">
                {t("library.modes.randomSymbol")}
              </span>
              <span>
                <strong>{t("library.modes.random")}</strong>
                <small>{t("library.wrong.randomDescription")}</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-mode-card exam"
              disabled={!hasQuestions}
              onClick={onStartExam}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">
                {t("library.modes.examSymbol")}
              </span>
              <span>
                <strong>{t("library.modes.exam")}</strong>
                <small>{t("library.modes.examDescription")}</small>
              </span>
            </button>
          </div>
        </section>

        <section className="wrong-list-section" aria-labelledby="wrong-list-title">
          <div className="section-heading">
            <h2 id="wrong-list-title">{t("library.wrong.list")}</h2>
            <span>{countLabel(t, "question", questions.length)}</span>
          </div>
          {hasQuestions ? (
            <div className="wrong-question-list">
              {questions.map((question) => {
                const metadata = [
                  question.number
                    ? t("library.question.original", {
                        number: question.number,
                      })
                    : "",
                  question.typeLabel ?? "",
                ].filter(Boolean).join(" · ");

                return (
                  <article className="wrong-question-row" key={question.id}>
                    <div>
                      {metadata ? <small>{metadata}</small> : null}
                      <strong>{question.stem}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveQuestion(question.id)}
                      aria-label={question.number
                        ? t("library.wrong.removeQuestionAria", {
                            number: question.number,
                          })
                        : t("library.wrong.removeGenericAria")}
                    >
                      {t("library.common.remove")}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="scope-empty-card">{t("library.scope.noWrong")}</div>
          )}
        </section>
      </div>
    </main>
  );
}

export function SettingsScreen({
  shuffleQuestions,
  shuffleOptions,
  onToggleQuestions,
  onToggleOptions,
  onBack,
  onOpenLibrary,
  onOpenModelApi,
  aiStatusLabel,
}: SettingsScreenProps) {
  const { preference, setPreference, t } = useI18n();
  const languageOptions = [
    {
      value: "system" as const,
      label: t("library.settings.followSystem"),
    },
    {
      value: "zh-CN" as const,
      label: t("library.settings.simplifiedChinese"),
    },
    {
      value: "en-US" as const,
      label: t("library.settings.english"),
    },
  ];

  return (
    <main className="app-shell library-shell settings-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.settings.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section
          className="settings-group"
          aria-labelledby="language-settings-title"
        >
          <div className="section-heading">
            <h2 id="language-settings-title">
              {t("library.settings.languageTitle")}
            </h2>
            <span>{t("library.settings.languageDescription")}</span>
          </div>
          <div
            className="settings-card language-options"
            role="radiogroup"
            aria-label={t("library.settings.languageAria")}
          >
            {languageOptions.map((option) => {
              const selected = preference === option.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`language-option ${selected ? "selected" : ""}`}
                  key={option.value}
                  onClick={() => setPreference(option.value)}
                >
                  <span>{option.label}</span>
                  <span className="language-option-check" aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-group" aria-labelledby="exam-settings-title">
          <div className="section-heading">
            <h2 id="exam-settings-title">{t("library.settings.exam")}</h2>
          </div>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-copy">
                <strong>{t("library.settings.shuffleQuestions")}</strong>
                <span>{t("library.settings.shuffleQuestionsDescription")}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={shuffleQuestions}
                aria-label={t("library.settings.shuffleQuestions")}
                className={`switch ${shuffleQuestions ? "on" : ""}`}
                onClick={onToggleQuestions}
              >
                <span className="sr-only">
                  {shuffleQuestions
                    ? t("library.settings.enabled")
                    : t("library.settings.disabled")}
                </span>
              </button>
            </div>
            <div className="setting-row">
              <span className="setting-copy">
                <strong>{t("library.settings.shuffleOptions")}</strong>
                <span>{t("library.settings.shuffleOptionsDescription")}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={shuffleOptions}
                aria-label={t("library.settings.shuffleOptions")}
                className={`switch ${shuffleOptions ? "on" : ""}`}
                onClick={onToggleOptions}
              >
                <span className="sr-only">
                  {shuffleOptions
                    ? t("library.settings.enabled")
                    : t("library.settings.disabled")}
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="settings-group" aria-labelledby="connection-settings-title">
          <div className="section-heading">
            <h2 id="connection-settings-title">
              {t("library.settings.aiService")}
            </h2>
          </div>
          <div className="settings-card settings-link-card">
            <button
              type="button"
              className="setting-link-row"
              onClick={onOpenModelApi}
            >
              <span className="setting-copy">
                <strong>{t("library.settings.modelApi")}</strong>
                <span>
                  {aiStatusLabel ?? t("library.settings.aiUnconfigured")}
                </span>
              </span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        <section className="settings-group" aria-labelledby="data-settings-title">
          <div className="section-heading">
            <h2 id="data-settings-title">{t("library.settings.data")}</h2>
          </div>
          <div className="info-card">
            <strong>{t("library.settings.localProgress")}</strong>
            <span>{t("library.settings.offlineAvailable")}</span>
          </div>
        </section>
      </div>

      <BottomNavigation
        active="settings"
        onLibrary={onOpenLibrary}
        onSettings={() => undefined}
      />
    </main>
  );
}

export function AiConfigScreen({
  initialValue,
  status = "unconfigured",
  statusMessage,
  isDiscovering = false,
  isSaving = false,
  isTesting = false,
  isClearing = false,
  canClear = false,
  keyStorageSecurity = "web-preview",
  onBack,
  onDiscoverModels,
  onTestConnection,
  onSave,
  onValueChange,
  onClear,
}: AiConfigScreenProps) {
  const { t } = useI18n();
  const providerId = useId();
  const baseUrlId = useId();
  const apiKeyId = useId();
  const modelSearchId = useId();
  const manualModelId = useId();
  const clearTitleId = useId();
  const clearDescriptionId = useId();
  const modelListRef = useRef<HTMLDivElement | null>(null);
  const clearDialogRef = useRef<HTMLElement | null>(null);
  const clearTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clearCancelRef = useRef<HTMLButtonElement | null>(null);
  const statusRegionRef = useRef<HTMLElement | null>(null);
  const clearReturnToStatusRef = useRef(false);
  const discoveryRequestRef = useRef(0);
  const [selectedProviderId, setSelectedProviderId] = useState(
    initialValue.providerId || DEFAULT_AI_PROVIDER_ID,
  );
  const [baseUrl, setBaseUrl] = useState(initialValue.baseUrl);
  const [apiKey, setApiKey] = useState(initialValue.apiKey);
  const [model, setModel] = useState(initialValue.model);
  const [detectedAt, setDetectedAt] = useState(initialValue.detectedAt);
  const [discoveryResult, setDiscoveryResult] =
    useState<AiModelDiscoveryResult | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [focusedModelId, setFocusedModelId] = useState("");
  const [manualModel, setManualModel] = useState(
    Boolean(initialValue.model),
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    if (!clearOpen) {
      return;
    }

    const trigger = clearTriggerRef.current;
    const focusFrame = globalThis.requestAnimationFrame(() => {
      clearCancelRef.current?.focus();
    });
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setClearOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = Array.from(
        clearDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      globalThis.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      const returnToStatus = clearReturnToStatusRef.current;
      if (
        !returnToStatus &&
        trigger?.isConnected &&
        !trigger.disabled
      ) {
        trigger.focus();
      }
    };
  }, [clearOpen]);

  const provider =
    AI_PROVIDER_DEFINITIONS.find(({ id }) => id === selectedProviderId) ??
    getAiProviderDefinition(DEFAULT_AI_PROVIDER_ID);
  const value = {
    providerId: provider.id,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    model: model.trim(),
    ...(detectedAt ? { detectedAt } : {}),
  };
  const canDiscover = Boolean(
    value.providerId && value.baseUrl && value.apiKey,
  );
  const canTest = Boolean(canDiscover && value.model);
  const canSave = canTest && status === "connected";
  const busy =
    isDiscovering ||
    isSaving ||
    isTesting ||
    isClearing ||
    status === "discovering" ||
    status === "testing";
  const statusCopy = statusMessage
    ?? t(`library.aiConfig.statusCopy.${status}`);
  const filteredModels = filterAiModels(
    discoveryResult?.models ?? [],
    modelQuery,
  );
  const tabbableModelId = filteredModels.some(
    (candidate) => candidate.id === focusedModelId,
  )
    ? focusedModelId
    : filteredModels.some((candidate) => candidate.id === model.trim())
      ? model.trim()
      : filteredModels[0]?.id ?? "";
  const savedModelMissing = Boolean(
    canClear &&
      initialValue.model &&
      initialValue.providerId === provider.id &&
      initialValue.baseUrl === value.baseUrl &&
      model.trim() === initialValue.model &&
      isModelMissingFromUpstream(model.trim(), discoveryResult),
  );

  const invalidateDiscovery = () => {
    discoveryRequestRef.current += 1;
    setDiscoveryResult(null);
    setDetectedAt(undefined);
    setModelQuery("");
    setFocusedModelId("");
  };

  const chooseProvider = (nextProviderId: string) => {
    const nextProvider = getAiProviderDefinition(nextProviderId);
    setSelectedProviderId(nextProvider.id);
    setBaseUrl(nextProvider.defaultBaseUrl);
    setApiKey("");
    setModel("");
    setManualModel(false);
    invalidateDiscovery();
    onValueChange?.();
  };

  const handleDiscovery = async () => {
    const requestId = discoveryRequestRef.current + 1;
    discoveryRequestRef.current = requestId;
    const requestValue = { ...value };
    const result = await onDiscoverModels(requestValue);
    if (requestId !== discoveryRequestRef.current || !result) {
      return;
    }
    setDiscoveryResult(result);
    setDetectedAt(result.detectedAt);
    setModelQuery("");
    setFocusedModelId(
      result.models.some((candidate) => candidate.id === model.trim())
        ? model.trim()
        : result.models[0]?.id ?? "",
    );
    setManualModel(
      Boolean(
        model.trim() &&
          !result.models.some((candidate) => candidate.id === model.trim()),
      ),
    );
  };

  const selectModel = (selectedModel: AiModel) => {
    setModel(selectedModel.id);
    setFocusedModelId(selectedModel.id);
    setManualModel(false);
    onValueChange?.();
  };

  const handleModelListKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    const options = Array.from(
      modelListRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) ?? [],
    );
    if (options.length === 0) {
      return;
    }
    event.preventDefault();
    const currentIndex = options.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : event.key === "ArrowUp"
          ? Math.max(0, currentIndex < 0 ? options.length - 1 : currentIndex - 1)
          : Math.min(options.length - 1, currentIndex + 1);
    options[nextIndex]?.focus();
  };

  const discoverySummary = discoveryResult?.source === "upstream"
    ? t("library.aiConfig.discovery.liveSummary", {
        count: discoveryResult.models.length,
      })
    : discoveryResult
      ? t(`library.aiConfig.discovery.warning.${discoveryResult.warning}`)
      : null;

  return (
    <main
      className="app-shell library-shell detail-shell ai-config-shell"
      aria-busy={busy}
    >
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.aiConfig.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="settings-group" aria-labelledby="ai-api-title">
          <div className="section-heading">
            <h2 id="ai-api-title">{t("library.aiConfig.connection")}</h2>
            <span>{t("library.aiConfig.compatibleApi")}</span>
          </div>
          <div className="ai-config-card">
            <label className="field-label" htmlFor={providerId}>
              {t("library.aiConfig.provider")}
            </label>
            <select
              id={providerId}
              className="text-field"
              value={provider.id}
              disabled={busy}
              onChange={(event) => chooseProvider(event.target.value)}
            >
              {AI_PROVIDER_DEFINITIONS.map((definition) => (
                <option value={definition.id} key={definition.id}>
                  {t(`library.aiConfig.provider.${definition.id}`)}
                </option>
              ))}
            </select>
            <small className="field-help">
              {t("library.aiConfig.providerHelp")}
            </small>

            {provider.homepageUrl ? (
              <div className="ai-provider-links">
                {[
                  ["homepage", provider.homepageUrl],
                  ["docs", provider.docsUrl],
                  ["apiKeyLink", provider.apiKeyUrl],
                ].map(([key, href]) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={key}
                  >
                    {t(`library.aiConfig.${key}`)}
                    <span className="sr-only">
                      {t("library.aiConfig.newWindow")}
                    </span>
                  </a>
                ))}
              </div>
            ) : null}

            <div className="ai-protocol-note">
              <span>{t("library.aiConfig.protocol")}</span>
              <strong>OpenAI Compatible</strong>
            </div>

            <label className="field-label field-label-spaced" htmlFor={baseUrlId}>
              {t("library.aiConfig.baseUrl")}
            </label>
            <input
              id={baseUrlId}
              className="text-field"
              type="url"
              inputMode="url"
              value={baseUrl}
              placeholder={t("library.aiConfig.baseUrlPlaceholder")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              readOnly={provider.lockedBaseUrl}
              aria-readonly={provider.lockedBaseUrl}
              disabled={busy && !provider.lockedBaseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                setApiKey("");
                setModel("");
                setManualModel(false);
                invalidateDiscovery();
                onValueChange?.();
              }}
            />
            <small className="field-help">
              {provider.lockedBaseUrl
                ? t("library.aiConfig.officialBaseUrlHelp")
                : t("library.aiConfig.baseUrlHelp")}
            </small>

            {!provider.lockedBaseUrl ? (
              <div className="ai-custom-provider-warning" role="note">
                <strong>{t("library.aiConfig.customWarningTitle")}</strong>
                <span>
                  {t("library.aiConfig.customWarning", {
                    url: value.baseUrl || t("library.aiConfig.addressNotSet"),
                  })}
                </span>
              </div>
            ) : null}

            <label className="field-label field-label-spaced" htmlFor={apiKeyId}>
              {t("library.aiConfig.apiKey")}
            </label>
            <div className="secret-field">
              <input
                id={apiKeyId}
                className="text-field"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                placeholder={t("library.aiConfig.apiKeyPlaceholder")}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  invalidateDiscovery();
                  onValueChange?.();
                }}
              />
              <button
                type="button"
                aria-label={showApiKey
                  ? t("library.aiConfig.hideApiKeyAria")
                  : t("library.aiConfig.showApiKeyAria")}
                aria-pressed={showApiKey}
                onClick={() => setShowApiKey((current) => !current)}
              >
                {showApiKey
                  ? t("library.aiConfig.hide")
                  : t("library.aiConfig.show")}
              </button>
            </div>
            <small className="field-help">
              {t(
                keyStorageSecurity === "secure"
                  ? "ai.keyStorage.secure"
                  : keyStorageSecurity === "memory"
                    ? "ai.keyStorage.memory"
                    : "ai.keyStorage.webPreview",
              )}
            </small>

            <div className="ai-discovery-action">
              <button
                type="button"
                className="secondary-button"
                disabled={!canDiscover || busy}
                onClick={() => void handleDiscovery()}
              >
                {isDiscovering
                  ? t("library.aiConfig.discovery.detecting")
                  : t("library.aiConfig.discovery.detect")}
              </button>
              <small>{t("library.aiConfig.discovery.help")}</small>
            </div>
          </div>
        </section>

        <section className="settings-group" aria-labelledby="ai-model-title">
          <div className="section-heading">
            <h2 id="ai-model-title">{t("library.aiConfig.chooseModel")}</h2>
            <span>{t("library.aiConfig.chooseModelHelp")}</span>
          </div>
          <div className="ai-config-card ai-model-picker">
            {discoverySummary ? (
              <div
                className={`ai-discovery-summary ${discoveryResult?.source ?? ""}`}
                role="status"
                aria-live="polite"
              >
                <strong>{discoverySummary}</strong>
                {discoveryResult?.detectedAt ? (
                  <span>
                    {t("library.aiConfig.discovery.detectedAt", {
                      time: new Date(discoveryResult.detectedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    })}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="ai-model-empty">
                {t("library.aiConfig.discovery.notRun")}
              </p>
            )}

            {discoveryResult?.models.length ? (
              <>
                <label className="field-label" htmlFor={modelSearchId}>
                  {t("library.aiConfig.searchModels")}
                </label>
                <input
                  id={modelSearchId}
                  className="text-field"
                  type="search"
                  value={modelQuery}
                  placeholder={t("library.aiConfig.searchModelsPlaceholder")}
                  disabled={busy}
                  onChange={(event) => setModelQuery(event.target.value)}
                />
                <div
                  className="ai-model-options"
                  role="listbox"
                  aria-label={t("library.aiConfig.modelListAria")}
                  ref={modelListRef}
                  onKeyDown={handleModelListKeyDown}
                >
                  {filteredModels.length ? (
                    filteredModels.map((candidate) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={model.trim() === candidate.id}
                        tabIndex={tabbableModelId === candidate.id ? 0 : -1}
                        className="ai-model-option"
                        disabled={busy}
                        key={candidate.id}
                        onFocus={() => setFocusedModelId(candidate.id)}
                        onClick={() => selectModel(candidate)}
                      >
                        <span>
                          <strong>{candidate.name}</strong>
                          {candidate.name !== candidate.id ? (
                            <code>{candidate.id}</code>
                          ) : null}
                        </span>
                        <span className="ai-model-badges">
                          {candidate.recommended ? (
                            <small>{t("library.aiConfig.badge.recommended")}</small>
                          ) : null}
                          {candidate.isReasoning ? (
                            <small>{t("library.aiConfig.badge.reasoning")}</small>
                          ) : null}
                          {candidate.releaseStage ? (
                            <small>
                              {t(`library.aiConfig.badge.${candidate.releaseStage}`)}
                            </small>
                          ) : null}
                          {candidate.contextWindow ? (
                            <small>
                              {t("library.aiConfig.badge.context", {
                                count: candidate.contextWindow.toLocaleString(),
                              })}
                            </small>
                          ) : null}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p>{t("library.aiConfig.noSearchResults")}</p>
                  )}
                </div>
              </>
            ) : null}

            {model && !manualModel ? (
              <div className="ai-selected-model">
                <span>{t("library.aiConfig.selectedModel")}</span>
                <strong>{model}</strong>
              </div>
            ) : null}

            <button
              type="button"
              className="ai-manual-model-toggle"
              aria-expanded={manualModel}
              disabled={busy}
              onClick={() => setManualModel((current) => !current)}
            >
              {t("library.aiConfig.manualModel")}
            </button>

            {manualModel ? (
              <div className="ai-manual-model-field">
                <label className="field-label" htmlFor={manualModelId}>
                  {t("library.aiConfig.manualModelId")}
                </label>
                <input
                  id={manualModelId}
                  className="text-field"
                  value={model}
                  placeholder={t("library.aiConfig.modelPlaceholder")}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={busy}
                  onChange={(event) => {
                    setModel(event.target.value);
                    onValueChange?.();
                  }}
                />
                <small className="field-help">
                  {t("library.aiConfig.manualModelHelp")}
                </small>
              </div>
            ) : null}

            {savedModelMissing ? (
              <div className="ai-model-missing" role="alert">
                <strong>{t("library.aiConfig.modelMissingTitle")}</strong>
                <span>{t("library.aiConfig.modelMissingDescription")}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section
          id={AI_CONFIG_STATUS_ID}
          className={`ai-connection-status ${status}`}
          ref={statusRegionRef}
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          aria-label={t("library.aiConfig.statusAria")}
          tabIndex={-1}
        >
          <span className="status-dot" aria-hidden="true" />
          <span>
            <strong>
              {t(`library.aiConfig.status.${status}`)}
            </strong>
            <small>{statusCopy}</small>
          </span>
        </section>

        <div className="ai-config-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!canTest || busy}
            onClick={() => onTestConnection(value)}
          >
            {isTesting || status === "testing"
              ? t("library.aiConfig.testing")
              : t("library.aiConfig.test")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canSave || busy}
            onClick={() => onSave(value)}
          >
            {isSaving
              ? t("library.aiConfig.saving")
              : t("library.aiConfig.save")}
          </button>
        </div>

        {!canSave && status !== "saved" ? (
          <p className="ai-save-requirement">
            {t("library.aiConfig.saveAfterTest")}
          </p>
        ) : null}

        {canClear && onClear ? (
          <button
            type="button"
            className="ai-config-clear-button"
            ref={clearTriggerRef}
            disabled={busy}
            onClick={() => {
              clearReturnToStatusRef.current = false;
              setClearOpen(true);
            }}
          >
            {isClearing
              ? t("library.aiConfig.clearing")
              : t("library.aiConfig.clearSaved")}
          </button>
        ) : null}

        <p className="bank-note">
          {t("library.aiConfig.reviewNote")}
        </p>
      </div>

      {clearOpen && onClear ? (
        <div className="sheet-backdrop">
          <section
            className="modal-card destructive-dialog compact-dialog"
            ref={clearDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={clearTitleId}
            aria-describedby={clearDescriptionId}
          >
            <span className="destructive-dialog-symbol" aria-hidden="true">
              {t("library.aiConfig.clearSymbol")}
            </span>
            <h2 id={clearTitleId}>{t("library.aiConfig.clearTitle")}</h2>
            <p id={clearDescriptionId}>
              {t("library.aiConfig.clearDescription")}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                ref={clearCancelRef}
                onClick={() => setClearOpen(false)}
              >
                {t("library.common.cancel")}
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={() => {
                  clearReturnToStatusRef.current = true;
                  setClearOpen(false);
                  const restoreStatusFocus = () => {
                    clearReturnToStatusRef.current = false;
                    globalThis.requestAnimationFrame(() => {
                      document.getElementById(AI_CONFIG_STATUS_ID)?.focus();
                    });
                  };
                  const clearRequest = Promise.resolve().then(onClear);
                  void clearRequest.then(
                    restoreStatusFocus,
                    restoreStatusFocus,
                  );
                }}
              >
                {t("library.aiConfig.clearConfirm")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export function AiPartitionIntentScreen({
  bankName,
  initialIntent = "",
  isConfigured,
  isBusy = false,
  errorMessage,
  onBack,
  onOpenSettings,
  onContinue,
}: AiPartitionIntentScreenProps) {
  const { t } = useI18n();
  const intentId = useId();
  const [intent, setIntent] = useState(initialIntent);
  const normalizedIntent = intent.trim();
  const examples = [
    t("library.aiIntent.exampleNumbers"),
    t("library.aiIntent.exampleSafety"),
    t("library.aiIntent.exampleMultipleChoice"),
  ];

  return (
    <main className="app-shell library-shell detail-shell ai-flow-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.common.back")}
          </button>
          <h1>{t("library.aiIntent.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="ai-flow-intro">
          <span className="ai-spark large" aria-hidden="true">AI</span>
          <div>
            <h2>{t("library.aiIntent.heading")}</h2>
            <p>{t("library.aiIntent.description", { name: bankName })}</p>
          </div>
        </section>

        {!isConfigured ? (
          <section className="ai-config-required" role="status">
            <div>
              <strong>{t("library.aiIntent.configRequired")}</strong>
              <span>{t("library.aiIntent.configRequiredDescription")}</span>
            </div>
            <button type="button" onClick={onOpenSettings}>
              {t("library.aiIntent.openSettings")}
            </button>
          </section>
        ) : null}

        <section className="ai-intent-card">
          <label className="field-label" htmlFor={intentId}>
            {t("library.aiIntent.label")}
          </label>
          <textarea
            id={intentId}
            className="ai-intent-field"
            value={intent}
            maxLength={500}
            placeholder={t("library.aiIntent.placeholder")}
            disabled={isBusy}
            onChange={(event) => setIntent(event.target.value)}
          />
          <div className="intent-field-meta">
            <span>{t("library.aiIntent.help")}</span>
            <span>{intent.length} / 500</span>
          </div>
        </section>

        <section className="intent-examples" aria-labelledby="intent-examples-title">
          <div className="section-heading">
            <h2 id="intent-examples-title">
              {t("library.aiIntent.examplesTitle")}
            </h2>
          </div>
          <div>
            {examples.map((example) => (
              <button
                type="button"
                key={example}
                disabled={isBusy}
                onClick={() => setIntent(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        {isBusy || errorMessage ? (
          <section
            className={`ai-intent-status ${errorMessage ? "error" : ""}`}
            role={errorMessage ? "alert" : "status"}
            aria-live="polite"
          >
            {errorMessage ?? t("library.aiIntent.organizing")}
          </section>
        ) : null}

        <button
          type="button"
          className="primary-button ai-flow-primary"
          disabled={!isConfigured || !normalizedIntent || isBusy}
          onClick={() => onContinue(normalizedIntent)}
        >
          {isBusy
            ? t("library.aiIntent.organizingButton")
            : t("library.aiIntent.next")}
        </button>
      </div>
    </main>
  );
}

export function AiPartitionConfirmScreen({
  bankName,
  questionCount,
  intent,
  summary,
  suggestedPartitionName,
  onBack,
  onStart,
}: AiPartitionConfirmScreenProps) {
  const { t } = useI18n();
  const normalizedSummary = summary?.trim();
  const showOriginalIntent = Boolean(
    normalizedSummary && normalizedSummary !== intent.trim(),
  );

  return (
    <main className="app-shell library-shell detail-shell ai-flow-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            {t("library.aiConfirm.modify")}
          </button>
          <h1>{t("library.aiConfirm.title")}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="ai-confirm-card">
          <span className="confirmation-label">
            {t(normalizedSummary
              ? "library.aiConfirm.summaryLabel"
              : "library.aiConfirm.intentLabel")}
          </span>
          <blockquote>{normalizedSummary ?? intent}</blockquote>
          <dl>
            {showOriginalIntent ? (
              <div>
                <dt>{t("library.aiConfirm.originalIntent")}</dt>
                <dd>{intent}</dd>
              </div>
            ) : null}
            <div>
              <dt>{t("library.aiConfirm.bank")}</dt>
              <dd>{bankName}</dd>
            </div>
            <div>
              <dt>{t("library.aiConfirm.scope")}</dt>
              <dd>{countLabel(t, "question", questionCount)}</dd>
            </div>
            {suggestedPartitionName ? (
              <div>
                <dt>{t("library.aiConfirm.suggestedName")}</dt>
                <dd>{suggestedPartitionName}</dd>
              </div>
            ) : null}
            <div>
              <dt>{t("library.aiConfirm.output")}</dt>
              <dd>{t("library.aiConfirm.outputDescription")}</dd>
            </div>
          </dl>
        </section>

        <section className="ai-boundary-card">
          <strong>{t("library.aiConfirm.noticeTitle")}</strong>
          <span>{t("library.aiConfirm.noticeDescription")}</span>
        </section>

        <button
          type="button"
          className="primary-button ai-flow-primary"
          onClick={onStart}
        >
          {t("library.aiConfirm.start")}
        </button>
      </div>
    </main>
  );
}

export function AiPartitionProcessingScreen({
  intent,
  questionCount,
  state = "processing",
  errorMessage,
  onCancel,
  onRetry,
}: AiPartitionProcessingScreenProps) {
  const { t } = useI18n();
  const hasError = state === "error";

  return (
    <main className="app-shell library-shell detail-shell ai-processing-shell">
      <section
        className={`ai-processing-card ${hasError ? "error" : ""}`}
        role={hasError ? "alert" : "status"}
        aria-live="polite"
      >
        {hasError ? (
          <span className="ai-processing-error" aria-hidden="true">!</span>
        ) : (
          <span className="ai-processing-spinner" aria-hidden="true" />
        )}
        <span className="ai-spark large" aria-hidden="true">AI</span>
        <h1>
          {hasError
            ? t("library.aiProcessing.failed")
            : t("library.aiProcessing.processing")}
        </h1>
        <p>{intent}</p>
        <small>
          {hasError
            ? (errorMessage ?? t("library.aiProcessing.errorFallback"))
            : questionCount
              ? t("library.aiProcessing.analyzingWithCount", {
                  count: questionCount,
                })
              : t("library.aiProcessing.analyzing")}
        </small>
        <div className="ai-processing-actions">
          {onCancel ? (
            <button type="button" className="quiet-button" onClick={onCancel}>
              {hasError
                ? t("library.common.back")
                : t("library.common.cancel")}
            </button>
          ) : null}
          {hasError && onRetry ? (
            <button type="button" className="primary-button" onClick={onRetry}>
              {t("library.common.retry")}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function AiPartitionReviewScreen({
  initialName,
  intent,
  questions,
  initialSelectedQuestionIds,
  note,
  onCancel,
  onRegenerate,
  onSave,
}: AiPartitionReviewScreenProps) {
  const { t } = useI18n();
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(
    () => new Set(initialSelectedQuestionIds),
  );
  const normalizedName = name.trim();

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  return (
    <main className="app-shell library-shell detail-shell partition-editor-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onCancel}>
            <span aria-hidden="true">‹</span>
            {t("library.common.cancel")}
          </button>
          <h1>{t("library.aiReview.title")}</h1>
          <button
            type="button"
            className="detail-settings-action"
            onClick={onRegenerate}
          >
            {t("library.aiReview.regenerate")}
          </button>
        </header>

        <section className="ai-review-summary">
          <span className="ai-spark" aria-hidden="true">AI</span>
          <div>
            <strong>
              {t("library.aiReview.candidateCount", {
                count: initialSelectedQuestionIds.length,
              })}
            </strong>
            <span>
              {note ?? t("library.aiReview.defaultNote")}
            </span>
          </div>
        </section>

        <section className="editor-name-card ai-review-name-card">
          <label className="field-label" htmlFor={inputId}>
            {t("library.partitionEditor.name")}
          </label>
          <input
            id={inputId}
            className="text-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <small className="field-help intent-summary">
            {t("library.aiReview.intentSummary", { intent })}
          </small>
        </section>

        <section
          className="partition-question-section"
          aria-labelledby="ai-question-review-title"
        >
          <div className="section-heading">
            <h2 id="ai-question-review-title">
              {t("library.aiReview.manualReview")}
            </h2>
            <span>
              {t("library.partitionEditor.selected", {
                count: selectedQuestionIds.size,
              })}
            </span>
          </div>
          {questions.length > 0 ? (
            <PartitionQuestionChecklist
              questions={questions}
              selectedQuestionIds={selectedQuestionIds}
              onToggle={toggleQuestion}
            />
          ) : (
            <div className="scope-empty-card">
              <strong>{t("library.aiReview.emptyTitle")}</strong>
              <span>{t("library.aiReview.emptyDescription")}</span>
            </div>
          )}
        </section>
      </div>

      <footer className="editor-action-bar">
        <div className="editor-action-bar-inner">
          <span>
            {t("library.partitionEditor.selected", {
              count: selectedQuestionIds.size,
            })}
          </span>
          <button
            type="button"
            disabled={!normalizedName || selectedQuestionIds.size === 0}
            onClick={() => onSave(
              normalizedName,
              Array.from(selectedQuestionIds),
            )}
          >
            {t("library.aiReview.savePartition")}
          </button>
        </div>
      </footer>
    </main>
  );
}
