"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  DEEPSEEK_API_BASE_URL,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_PRO_MODEL,
} from "./ai-config";

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
  | "testing"
  | "connected"
  | "error";

export interface AiConfigValue {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiConfigScreenProps {
  initialValue: AiConfigValue;
  status?: AiConnectionStatus;
  statusMessage?: string;
  isSaving?: boolean;
  isTesting?: boolean;
  isClearing?: boolean;
  canClear?: boolean;
  onBack: () => void;
  onTestConnection: (value: AiConfigValue) => void;
  onSave: (value: AiConfigValue) => void;
  onValueChange?: () => void;
  onClear?: () => void;
}

export interface AiPartitionIntentScreenProps {
  bankName: string;
  initialIntent?: string;
  isConfigured: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  onContinue: (intent: string) => void;
}

export interface AiPartitionConfirmScreenProps {
  bankName: string;
  questionCount: number;
  intent: string;
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

function BottomNavigation({
  active,
  onLibrary,
  onSettings,
}: {
  active: "library" | "settings";
  onLibrary: () => void;
  onSettings: () => void;
}) {
  return (
    <nav className="library-bottom-nav" aria-label="主导航">
      <div className="library-bottom-nav-inner">
        <button
          type="button"
          className={active === "library" ? "active" : ""}
          aria-current={active === "library" ? "page" : undefined}
          onClick={onLibrary}
        >
          <span className="nav-dot" aria-hidden="true" />
          题库
        </button>
        <button
          type="button"
          className={active === "settings" ? "active" : ""}
          aria-current={active === "settings" ? "page" : undefined}
          onClick={onSettings}
        >
          <span className="nav-dot" aria-hidden="true" />
          设置
        </button>
      </div>
    </nav>
  );
}

function ProgressBar({ value }: { value: number }) {
  const progress = Math.min(100, Math.max(0, value));

  return (
    <div
      className="bank-progress-track"
      role="progressbar"
      aria-label="练习进度"
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
  return (
    <div className="partition-question-list">
      {questions.map((question) => {
        const checked = selectedQuestionIds.has(question.id);
        const metadata = [
          question.number ? `原题第 ${question.number} 题` : "",
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
            <p className="page-kicker">离线优先 · 企业学习</p>
            <h1>QuizDeck</h1>
          </div>
          <button
            type="button"
            className="header-action"
            onClick={() => fileInputRef.current?.click()}
            data-testid="import-bank"
          >
            导入
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
            <h2 id="bank-list-title">全部题库</h2>
            <span>{banks.length} 个</span>
          </div>

          {banks.length > 0 ? (
            <div className="library-bank-list">
              {banks.map((bank) => {
                const progress = bank.session?.percentage ?? 0;
                const primaryLabel = bank.session
                  ? bank.session.submitted
                    ? "查看上次结果"
                    : "继续练习"
                  : "开始练习";

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
                          {bank.questionCount} 题 · {bank.gradableCount} 题可计分
                        </span>
                      </span>
                      <span className="chevron" aria-hidden="true">›</span>
                    </button>

                    <div className="bank-progress-copy">
                      <span>
                        {bank.session
                          ? `已答 ${bank.session.answered} / ${bank.session.total}`
                          : "尚未开始"}
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
              <strong>暂无题库</strong>
              <span>点击右上角“导入”选择题库文件。</span>
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
  const progress = session?.percentage ?? 0;

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>题库详情</h1>
          <button
            type="button"
            className="detail-settings-action"
            onClick={onOpenSettings}
          >
            设置
          </button>
        </header>

        <section className="bank-overview">
          <h2>{bankName}</h2>
          <p>
            {questionCount} 题
            {session ? ` · 已答 ${session.answered} 题` : ""}
          </p>
          <div className="overview-progress-copy">
            <span>练习进度</span>
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
              {session.submitted ? "查看上次结果" : "继续练习"}
            </button>
          ) : null}
        </section>

        <section className="mode-section" aria-labelledby="mode-title">
          <div className="section-heading">
            <h2 id="mode-title">练习方式</h2>
          </div>

          <button
            type="button"
            className="mode-featured"
            onClick={onStartSequential}
            data-testid="start-sequential"
          >
            <span className="mode-symbol" aria-hidden="true">序</span>
            <span>
              <strong>顺序练习</strong>
              <small>按原题与原选项顺序练习</small>
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
              <span className="secondary-mode-symbol" aria-hidden="true">随</span>
              <span>
                <strong>随机练习</strong>
                <small>题目和选项重新排序</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-mode-card exam"
              onClick={onStartExam}
              data-testid="start-exam"
            >
              <span className="secondary-mode-symbol" aria-hidden="true">考</span>
              <span>
                <strong>模拟考试</strong>
                <small>交卷后统一查看答案</small>
              </span>
            </button>
          </div>
        </section>

        <section className="scope-section" aria-labelledby="scope-title">
          <div className="section-heading">
            <h2 id="scope-title">题目范围</h2>
          </div>
          <div className="scope-card scope-list-card">
            <ScopeRow
              symbol="全"
              title="全部题目"
              detail={`${questionCount} 题 · ${gradableCount} 题可计分`}
              onClick={onOpenAllQuestions}
            />
            <div className="type-counts scope-type-counts" aria-label="题型统计">
              <span>单选 {typeCounts.single}</span>
              <span>多选 {typeCounts.multiple}</span>
              <span>判断 {typeCounts.judge}</span>
              <span>填空 {typeCounts.fill}</span>
            </div>
            <ScopeRow
              symbol="文"
              title="文件分类"
              detail={categoryCount > 0
                ? `${categoryCount} 个分类`
                : "原文件未包含分类"}
              disabled={categoryCount === 0}
              onClick={onOpenCategories}
            />
            <ScopeRow
              symbol="区"
              title="自建分区"
              detail={partitionCount > 0
                ? `${partitionCount} 个分区`
                : "暂无分区，点击新建"}
              onClick={onOpenPartitions}
            />
            <ScopeRow
              symbol="错"
              title="错题专项"
              detail={wrongCount > 0 ? `${wrongCount} 题` : "暂无错题"}
              disabled={wrongCount === 0}
              onClick={onOpenWrongQuestions}
            />
          </div>
        </section>

        <p className="bank-note">
          源文件无解析；缺少对应选项的题目保留原题但不计分。
        </p>

        {isImported || onDeleteBank ? (
          <section
            className="settings-group bank-management-section"
            aria-labelledby="bank-management-title"
          >
            <div className="section-heading">
              <h2 id="bank-management-title">题库管理</h2>
              <span>低频操作</span>
            </div>
            <div className="settings-card settings-link-card">
              {onOpenImportIssues ? (
                <button
                  type="button"
                  className="setting-link-row"
                  onClick={onOpenImportIssues}
                >
                  <span className="setting-copy">
                    <strong>导入问题详情</strong>
                    <span>
                      {importIssueCount > 0
                        ? `${importIssueCount} 项需要核对`
                        : "未发现结构异常"}
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
                    <strong>重命名题库</strong>
                    <span>仅修改本机显示名称</span>
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
                    <strong>删除题库</strong>
                    <span>同时移除本机进度、错题和自建分区</span>
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
          <h2 id="import-result-title">导入结果</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label="取消导入"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="sheet-body">
          <label className="field-label" htmlFor={inputId}>题库名称</label>
          <input
            id={inputId}
            className="text-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />

          <div className="import-summary" aria-label="导入摘要">
            <div>
              <span>题目</span>
              <strong>{questionCount} 题</strong>
            </div>
            <div>
              <span>文件分类</span>
              <strong>
                {categoryCount > 0 ? `${categoryCount} 个` : "未包含"}
              </strong>
            </div>
            <div>
              <span>结构异常</span>
              <strong className={issueCount > 0 ? "has-issues" : ""}>
                {issueCount} 项
              </strong>
            </div>
          </div>

          <p className="import-issue-summary">
            {issueSummary
              ?? (issueCount > 0
                ? `发现 ${issueCount} 项结构异常，请在进入题库后核对。`
                : "未发现结构异常。")}
          </p>

          {duplicateBankName || duplicateWarning ? (
            <div className="duplicate-import-warning" role="status">
              <span aria-hidden="true">!</span>
              <div>
                <strong>可能重复导入</strong>
                <p>
                  {duplicateWarning
                    ?? `已存在题库“${duplicateBankName}”。你仍可继续保存为独立题库。`}
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
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!normalizedName}
            onClick={() => onSave(normalizedName)}
          >
            保存并进入
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
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>导入问题详情</h1>
          <span aria-hidden="true" />
        </header>

        <section className="bank-overview import-issue-overview">
          <h2>{issues.length} 项</h2>
          <p>
            {errorCount > 0
              ? `${errorCount} 项会影响计分，其余题目仍可正常使用。`
              : "这些提示不影响其余题目正常使用。"}
          </p>
        </section>

        <section
          className="import-issue-section"
          aria-labelledby="import-issue-list-title"
        >
          <div className="section-heading">
            <h2 id="import-issue-list-title">{bankName}</h2>
            <span>{sourceFileName ?? "导入题库"}</span>
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
                        ? `原题第 ${issue.questionNumber} 题`
                        : "文件结构"}
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
              <strong>未发现导入问题</strong>
              <span>题目结构检查已通过。</span>
            </div>
          )}
        </section>

        <p className="bank-note">
          应用不会补写源文件中不存在的答案或解析。
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
          <h2 id="rename-bank-title">重命名题库</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label="取消重命名"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="sheet-body">
          <label className="field-label" htmlFor={inputId}>题库名称</label>
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
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!normalizedName || normalizedName === currentName.trim()}
            onClick={() => onSave(normalizedName)}
          >
            保存
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
  return (
    <div className="sheet-backdrop">
      <section
        className="modal-card destructive-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-bank-title"
        aria-describedby="delete-bank-description"
      >
        <span className="destructive-dialog-symbol" aria-hidden="true">删</span>
        <h2 id="delete-bank-title">删除“{bankName}”？</h2>
        <p id="delete-bank-description">
          题目、答题进度、错题和自建分区都会从当前设备移除，此操作无法撤销。
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            onClick={onConfirm}
          >
            删除
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
  return (
    <div className="sheet-backdrop">
      <section
        className="modal-card destructive-dialog compact-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-partition-title"
        aria-describedby="delete-partition-description"
      >
        <span className="destructive-dialog-symbol" aria-hidden="true">删</span>
        <h2 id="delete-partition-title">删除“{partitionName}”？</h2>
        <p id="delete-partition-description">
          将移除这个分区及其中 {questionCount} 道题的引用，不会删除原题或错题记录。
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            onClick={onConfirm}
          >
            删除分区
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
  const isPartitions = kind === "partitions";
  const title = isPartitions ? "自建分区" : "文件分类";
  const emptyText = isPartitions ? "暂无自建分区" : "原文件未包含分类";

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>{title}</h1>
          {isPartitions && onCreatePartition ? (
            <button
              type="button"
              className="detail-settings-action"
              onClick={onCreatePartition}
            >
              新建
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </header>

        {isPartitions && onCreateWithAi ? (
          <section className="ai-create-callout" aria-label="AI 创建分区">
            <span className="ai-spark" aria-hidden="true">AI</span>
            <span>
              <strong>按你的意愿挑题</strong>
              <small>描述想记的内容，由 AI 给出候选题目，再由你确认。</small>
            </span>
            <button type="button" onClick={onCreateWithAi}>
              AI 创建
            </button>
          </section>
        ) : null}

        <section aria-labelledby="scope-list-title">
          <div className="section-heading">
            <h2 id="scope-list-title">{title}</h2>
            <span>{items.length} 个</span>
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
                        <span className="scope-icon" aria-hidden="true">区</span>
                        <span className="scope-directory-copy">
                          <strong>{item.name}</strong>
                          <small>{item.questionCount} 题</small>
                        </span>
                        <span className="chevron" aria-hidden="true">›</span>
                      </button>
                      <span className="partition-row-actions">
                        {onEditPartition ? (
                          <button
                            type="button"
                            onClick={() => onEditPartition(item.id)}
                            aria-label={`编辑分区“${item.name}”`}
                          >
                            编辑
                          </button>
                        ) : null}
                        {onDeletePartition ? (
                          <button
                            type="button"
                            className="danger-text-button"
                            onClick={() => onDeletePartition(item.id)}
                            aria-label={`删除分区“${item.name}”`}
                          >
                            删除
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
                      {isPartitions ? "区" : "文"}
                    </span>
                    <span className="scope-directory-copy">
                      <strong>{item.name}</strong>
                      <small>{item.questionCount} 题</small>
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
  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>练习范围</h1>
          <span aria-hidden="true" />
        </header>

        <section className="bank-overview scope-practice-overview">
          <span className="scope-icon" aria-hidden="true">范</span>
          <div>
            <h2>{scopeName}</h2>
            <p>{questionCount} 题</p>
          </div>
        </section>

        <section className="mode-section" aria-labelledby="scope-mode-title">
          <div className="section-heading">
            <h2 id="scope-mode-title">练习方式</h2>
          </div>
          <button
            type="button"
            className="mode-featured"
            onClick={onStartSequential}
          >
            <span className="mode-symbol" aria-hidden="true">序</span>
            <span>
              <strong>顺序练习</strong>
              <small>按当前范围的原题顺序练习</small>
            </span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <div className="secondary-mode-grid">
            <button
              type="button"
              className="secondary-mode-card"
              onClick={onStartRandom}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">随</span>
              <span>
                <strong>随机练习</strong>
                <small>重新排列当前范围题目</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-mode-card exam"
              onClick={onStartExam}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">考</span>
              <span>
                <strong>模拟考试</strong>
                <small>交卷后统一查看答案</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PartitionEditorScreen({
  title = "编辑自建分区",
  initialName = "",
  questions,
  initialSelectedQuestionIds = [],
  onCancel,
  onSave,
}: PartitionEditorScreenProps) {
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
            取消
          </button>
          <h1>{title}</h1>
          <span aria-hidden="true" />
        </header>

        <section className="editor-name-card">
          <label className="field-label" htmlFor={inputId}>分区名称</label>
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
            <h2 id="question-select-title">选择题目</h2>
            <span>已选 {selectedQuestionIds.size} 题</span>
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
          <span>已选 <strong>{selectedQuestionIds.size}</strong> 题</span>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(
              normalizedName,
              Array.from(selectedQuestionIds),
            )}
          >
            保存
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
  const hasQuestions = questions.length > 0;

  return (
    <main className="app-shell library-shell detail-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>错题专项</h1>
          <span aria-hidden="true" />
        </header>

        <section className="bank-overview wrong-overview">
          <h2>{questions.length} 题</h2>
          <p>移除错题记录不会删除原题。</p>
        </section>

        <section className="mode-section" aria-labelledby="wrong-mode-title">
          <div className="section-heading">
            <h2 id="wrong-mode-title">练习方式</h2>
          </div>
          <button
            type="button"
            className="mode-featured"
            disabled={!hasQuestions}
            onClick={onStartSequential}
          >
            <span className="mode-symbol" aria-hidden="true">序</span>
            <span>
              <strong>顺序练习</strong>
              <small>按错题记录顺序练习</small>
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
              <span className="secondary-mode-symbol" aria-hidden="true">随</span>
              <span>
                <strong>随机练习</strong>
                <small>重新排列当前错题</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-mode-card exam"
              disabled={!hasQuestions}
              onClick={onStartExam}
            >
              <span className="secondary-mode-symbol" aria-hidden="true">考</span>
              <span>
                <strong>模拟考试</strong>
                <small>交卷后统一查看答案</small>
              </span>
            </button>
          </div>
        </section>

        <section className="wrong-list-section" aria-labelledby="wrong-list-title">
          <div className="section-heading">
            <h2 id="wrong-list-title">错题列表</h2>
            <span>{questions.length} 题</span>
          </div>
          {hasQuestions ? (
            <div className="wrong-question-list">
              {questions.map((question) => {
                const metadata = [
                  question.number ? `原题第 ${question.number} 题` : "",
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
                      aria-label={`移除${question.number ? `第 ${question.number} 题` : "错题"}`}
                    >
                      移除
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="scope-empty-card">暂无错题</div>
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
  aiStatusLabel = "未配置",
}: SettingsScreenProps) {
  return (
    <main className="app-shell library-shell settings-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>设置</h1>
          <span aria-hidden="true" />
        </header>

        <section className="settings-group" aria-labelledby="exam-settings-title">
          <div className="section-heading">
            <h2 id="exam-settings-title">模拟考试</h2>
          </div>
          <div className="settings-card">
            <div className="setting-row">
              <span className="setting-copy">
                <strong>题目乱序</strong>
                <span>每次考试生成新的题目顺序</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={shuffleQuestions}
                aria-label="题目乱序"
                className={`switch ${shuffleQuestions ? "on" : ""}`}
                onClick={onToggleQuestions}
              >
                <span className="sr-only">
                  {shuffleQuestions ? "已开启" : "已关闭"}
                </span>
              </button>
            </div>
            <div className="setting-row">
              <span className="setting-copy">
                <strong>选项乱序</strong>
                <span>判断题及依赖顺序的题目保持原样</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={shuffleOptions}
                aria-label="选项乱序"
                className={`switch ${shuffleOptions ? "on" : ""}`}
                onClick={onToggleOptions}
              >
                <span className="sr-only">
                  {shuffleOptions ? "已开启" : "已关闭"}
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="settings-group" aria-labelledby="connection-settings-title">
          <div className="section-heading">
            <h2 id="connection-settings-title">AI 模型服务</h2>
          </div>
          <div className="settings-card settings-link-card">
            <button
              type="button"
              className="setting-link-row"
              onClick={onOpenModelApi}
            >
              <span className="setting-copy">
                <strong>模型 API</strong>
                <span>{aiStatusLabel}</span>
              </span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        <section className="settings-group" aria-labelledby="data-settings-title">
          <div className="section-heading">
            <h2 id="data-settings-title">数据</h2>
          </div>
          <div className="info-card">
            <strong>答题进度保存在当前设备</strong>
            <span>练习、考试和题目内容均可离线使用。</span>
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
  isSaving = false,
  isTesting = false,
  isClearing = false,
  canClear = false,
  onBack,
  onTestConnection,
  onSave,
  onValueChange,
  onClear,
}: AiConfigScreenProps) {
  const baseUrlId = useId();
  const apiKeyId = useId();
  const modelId = useId();
  const clearTitleId = useId();
  const clearDescriptionId = useId();
  const [baseUrl, setBaseUrl] = useState(initialValue.baseUrl);
  const [apiKey, setApiKey] = useState(initialValue.apiKey);
  const [model, setModel] = useState(initialValue.model);
  const [showApiKey, setShowApiKey] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const value = {
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    model: model.trim(),
  };
  const canSubmit = Boolean(value.baseUrl && value.apiKey && value.model);
  const busy =
    isSaving || isTesting || isClearing || status === "testing";
  const statusCopy = statusMessage ?? {
    unconfigured: "填写并测试后即可使用 AI 分区。",
    saved: "配置已保存在当前设备，建议测试连接。",
    testing: "正在测试连接…",
    connected: "连接正常，可以使用 AI 分区。",
    error: "连接失败，请检查地址、密钥和模型名称。",
  }[status];
  const applyDeepSeekPreset = (selectedModel: string) => {
    setBaseUrl(DEEPSEEK_API_BASE_URL);
    setModel(selectedModel);
    onValueChange?.();
  };

  return (
    <main className="app-shell library-shell detail-shell ai-config-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>模型 API</h1>
          <span aria-hidden="true" />
        </header>

        <section className="settings-group" aria-labelledby="ai-api-title">
          <div className="section-heading">
            <h2 id="ai-api-title">连接配置</h2>
            <span>OpenAI 兼容接口</span>
          </div>
          <div className="ai-config-card">
            <div className="ai-provider-preset">
              <span>
                <strong>DeepSeek 官方</strong>
                <small>自动填写接口地址和当前可用模型</small>
              </span>
              <div>
                <button
                  type="button"
                  aria-pressed={
                    baseUrl.trim() === DEEPSEEK_API_BASE_URL &&
                    model.trim() === DEEPSEEK_DEFAULT_MODEL
                  }
                  disabled={busy}
                  onClick={() =>
                    applyDeepSeekPreset(DEEPSEEK_DEFAULT_MODEL)
                  }
                >
                  V4 Flash（推荐）
                </button>
                <button
                  type="button"
                  aria-pressed={
                    baseUrl.trim() === DEEPSEEK_API_BASE_URL &&
                    model.trim() === DEEPSEEK_PRO_MODEL
                  }
                  disabled={busy}
                  onClick={() =>
                    applyDeepSeekPreset(DEEPSEEK_PRO_MODEL)
                  }
                >
                  V4 Pro
                </button>
              </div>
            </div>

            <label className="field-label" htmlFor={baseUrlId}>接口地址</label>
            <input
              id={baseUrlId}
              className="text-field"
              type="url"
              inputMode="url"
              value={baseUrl}
              placeholder="https://api.deepseek.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                onValueChange?.();
              }}
            />
            <small className="field-help">
              填写服务商提供的 API 根地址，不要填写聊天网页地址。
            </small>

            <label className="field-label field-label-spaced" htmlFor={apiKeyId}>
              API Key
            </label>
            <div className="secret-field">
              <input
                id={apiKeyId}
                className="text-field"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                placeholder="sk-…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setApiKey(event.target.value);
                  onValueChange?.();
                }}
              />
              <button
                type="button"
                aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                aria-pressed={showApiKey}
                onClick={() => setShowApiKey((current) => !current)}
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
            <small className="field-help">
              Android 使用系统密钥库加密保存；网页预览会以明文保存在本机浏览器，
              仅适合本地预览，请勿在共享设备保存真实密钥。
            </small>

            <label className="field-label field-label-spaced" htmlFor={modelId}>
              模型
            </label>
            <input
              id={modelId}
              className="text-field"
              value={model}
              placeholder="deepseek-v4-flash"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                setModel(event.target.value);
                onValueChange?.();
              }}
            />
            <small className="field-help">
              DeepSeek 请使用 deepseek-v4-flash 或 deepseek-v4-pro；
              已停用的旧模型名会自动迁移。
            </small>
          </div>
        </section>

        <section
          className={`ai-connection-status ${status}`}
          aria-live="polite"
          aria-label="模型连接状态"
        >
          <span className="status-dot" aria-hidden="true" />
          <span>
            <strong>
              {status === "connected"
                ? "已连接"
                : status === "error"
                  ? "连接异常"
                  : status === "testing"
                    ? "测试中"
                    : status === "saved"
                      ? "已保存"
                      : "未配置"}
            </strong>
            <small>{statusCopy}</small>
          </span>
        </section>

        <div className="ai-config-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!canSubmit || busy}
            onClick={() => onTestConnection(value)}
          >
            {isTesting || status === "testing" ? "测试中…" : "测试连接"}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canSubmit || busy}
            onClick={() => onSave(value)}
          >
            {isSaving ? "保存中…" : "保存配置"}
          </button>
        </div>

        {canClear && onClear ? (
          <button
            type="button"
            className="ai-config-clear-button"
            disabled={busy}
            onClick={() => setClearOpen(true)}
          >
            {isClearing ? "清除中…" : "清除已保存配置"}
          </button>
        ) : null}

        <p className="bank-note">
          AI 仅用于按意愿筛选候选题目；保存前仍由你人工核对。
        </p>
      </div>

      {clearOpen && onClear ? (
        <div className="sheet-backdrop">
          <section
            className="modal-card destructive-dialog compact-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={clearTitleId}
            aria-describedby={clearDescriptionId}
          >
            <span className="destructive-dialog-symbol" aria-hidden="true">
              清
            </span>
            <h2 id={clearTitleId}>清除模型配置？</h2>
            <p id={clearDescriptionId}>
              接口地址、模型名称和 API Key 都会从当前设备移除。
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setClearOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={() => {
                  setClearOpen(false);
                  onClear();
                }}
              >
                清除配置
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
  onBack,
  onOpenSettings,
  onContinue,
}: AiPartitionIntentScreenProps) {
  const intentId = useId();
  const [intent, setIntent] = useState(initialIntent);
  const normalizedIntent = intent.trim();
  const examples = [
    "把容易混淆的数字、期限和比例题放在一起",
    "筛选安全作业和应急处置相关题目",
    "找出我需要重点记忆的多选题",
  ];

  return (
    <main className="app-shell library-shell detail-shell ai-flow-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1>AI 创建分区</h1>
          <span aria-hidden="true" />
        </header>

        <section className="ai-flow-intro">
          <span className="ai-spark large" aria-hidden="true">AI</span>
          <div>
            <h2>你想集中记哪些内容？</h2>
            <p>AI 会从“{bankName}”中挑选候选题目，不会修改原题。</p>
          </div>
        </section>

        {!isConfigured ? (
          <section className="ai-config-required" role="status">
            <div>
              <strong>需要先配置模型 API</strong>
              <span>配置完成后即可按描述筛选题目。</span>
            </div>
            <button type="button" onClick={onOpenSettings}>去配置</button>
          </section>
        ) : null}

        <section className="ai-intent-card">
          <label className="field-label" htmlFor={intentId}>分区意愿</label>
          <textarea
            id={intentId}
            className="ai-intent-field"
            value={intent}
            maxLength={500}
            placeholder="例如：帮我找出涉及检修周期、时间限制和数值标准的题目，方便集中背诵。"
            onChange={(event) => setIntent(event.target.value)}
          />
          <div className="intent-field-meta">
            <span>描述越具体，候选结果越贴近你的意愿</span>
            <span>{intent.length} / 500</span>
          </div>
        </section>

        <section className="intent-examples" aria-labelledby="intent-examples-title">
          <div className="section-heading">
            <h2 id="intent-examples-title">可以这样说</h2>
          </div>
          <div>
            {examples.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => setIntent(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="primary-button ai-flow-primary"
          disabled={!isConfigured || !normalizedIntent}
          onClick={() => onContinue(normalizedIntent)}
        >
          下一步
        </button>
      </div>
    </main>
  );
}

export function AiPartitionConfirmScreen({
  bankName,
  questionCount,
  intent,
  onBack,
  onStart,
}: AiPartitionConfirmScreenProps) {
  return (
    <main className="app-shell library-shell detail-shell ai-flow-shell">
      <div className="library-page">
        <header className="detail-header">
          <button type="button" className="back-action" onClick={onBack}>
            <span aria-hidden="true">‹</span>
            修改
          </button>
          <h1>确认 AI 分区</h1>
          <span aria-hidden="true" />
        </header>

        <section className="ai-confirm-card">
          <span className="confirmation-label">你的意愿</span>
          <blockquote>{intent}</blockquote>
          <dl>
            <div>
              <dt>题库</dt>
              <dd>{bankName}</dd>
            </div>
            <div>
              <dt>筛选范围</dt>
              <dd>{questionCount} 题</dd>
            </div>
            <div>
              <dt>输出方式</dt>
              <dd>候选题目，人工确认后保存</dd>
            </div>
          </dl>
        </section>

        <section className="ai-boundary-card">
          <strong>开始前请注意</strong>
          <span>
            点击“确认并开始”后，当前题库的题干和选项才会发送到你配置的接口。
            未确认前不会发送题库内容。AI 可能漏选或误选，生成后请逐题核对。
          </span>
        </section>

        <button
          type="button"
          className="primary-button ai-flow-primary"
          onClick={onStart}
        >
          确认并开始
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
        <h1>{hasError ? "生成失败" : "正在筛选候选题目"}</h1>
        <p>{intent}</p>
        <small>
          {hasError
            ? (errorMessage ?? "请检查模型配置或网络连接后重试。")
            : `正在分析${questionCount ? ` ${questionCount} 道` : ""}题目，请保持应用在前台。`}
        </small>
        <div className="ai-processing-actions">
          {onCancel ? (
            <button type="button" className="quiet-button" onClick={onCancel}>
              {hasError ? "返回" : "取消"}
            </button>
          ) : null}
          {hasError && onRetry ? (
            <button type="button" className="primary-button" onClick={onRetry}>
              重试
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
            取消
          </button>
          <h1>核对 AI 候选</h1>
          <button
            type="button"
            className="detail-settings-action"
            onClick={onRegenerate}
          >
            重新生成
          </button>
        </header>

        <section className="ai-review-summary">
          <span className="ai-spark" aria-hidden="true">AI</span>
          <div>
            <strong>
              AI 候选 {initialSelectedQuestionIds.length} 道
            </strong>
            <span>
              {note ?? "可以移除误选，也可以从全部题目中补充遗漏后再保存。"}
            </span>
          </div>
        </section>

        <section className="editor-name-card ai-review-name-card">
          <label className="field-label" htmlFor={inputId}>分区名称</label>
          <input
            id={inputId}
            className="text-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <small className="field-help intent-summary">筛选意愿：{intent}</small>
        </section>

        <section
          className="partition-question-section"
          aria-labelledby="ai-question-review-title"
        >
          <div className="section-heading">
            <h2 id="ai-question-review-title">人工核对</h2>
            <span>已选 {selectedQuestionIds.size} 题</span>
          </div>
          {questions.length > 0 ? (
            <PartitionQuestionChecklist
              questions={questions}
              selectedQuestionIds={selectedQuestionIds}
              onToggle={toggleQuestion}
            />
          ) : (
            <div className="scope-empty-card">
              <strong>没有找到候选题目</strong>
              <span>可以返回修改描述，或重新生成。</span>
            </div>
          )}
        </section>
      </div>

      <footer className="editor-action-bar">
        <div className="editor-action-bar-inner">
          <span>已选 <strong>{selectedQuestionIds.size}</strong> 题</span>
          <button
            type="button"
            disabled={!normalizedName || selectedQuestionIds.size === 0}
            onClick={() => onSave(
              normalizedName,
              Array.from(selectedQuestionIds),
            )}
          >
            保存分区
          </button>
        </div>
      </footer>
    </main>
  );
}
