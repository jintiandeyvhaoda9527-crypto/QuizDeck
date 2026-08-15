import * as XLSX from "xlsx";

import type {
  FileCategory,
  ImportedBankDraft,
  ImportIssue,
} from "./bank-types";
import type { Question, QuestionType } from "./quiz-core";

type MatrixRow = unknown[];

interface HeaderColumns {
  number?: number;
  type?: number;
  stem: number;
  answer?: number;
  category?: number;
  options: Map<string, number>;
}

interface SheetScan {
  sheetIndex: number;
  sheetName: string;
  rows: MatrixRow[];
  headerRowIndex: number | null;
  columns: HeaderColumns | null;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SHEETS = 32;
const MAX_TOTAL_ROWS = 20_000;
const MAX_NON_EMPTY_CELLS = 100_000;
const MAX_QUESTIONS = 5_000;
const MAX_CELL_TEXT_LENGTH = 8_000;

const NUMBER_HEADERS = new Set([
  "序号",
  "题号",
  "编号",
  "题目编号",
  "试题编号",
  "no",
  "num",
  "number",
]);

const TYPE_HEADERS = new Set([
  "题型",
  "类型",
  "题目类型",
  "试题类型",
]);

const STEM_HEADERS = new Set([
  "题干",
  "题目",
  "试题",
  "问题",
  "题目内容",
  "试题内容",
]);

const ANSWER_HEADERS = new Set([
  "答案",
  "正确答案",
  "标准答案",
  "参考答案",
]);

const CATEGORY_HEADERS = new Set([
  "分类",
  "类别",
  "章节",
  "章",
  "分组",
  "题目分类",
  "试题分类",
  "所属分类",
  "所属章节",
  "知识点",
]);

const POSITIVE_JUDGE_VALUES = new Set([
  "正确",
  "对",
  "是",
  "√",
  "true",
  "t",
  "yes",
]);

const NEGATIVE_JUDGE_VALUES = new Set([
  "错误",
  "错",
  "否",
  "×",
  "false",
  "f",
  "no",
]);

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\r\n?/g, "\n")
    .trim();
}

function normalizedHeader(value: unknown): string {
  return cellText(value)
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s:：._\-—/\\()[\]（）【】*＊]+/g, "");
}

function normalizedCategoryKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

function optionKeyFromHeader(value: unknown): string | null {
  const header = normalizedHeader(value).toUpperCase();
  const match = /^(?:选项)?([A-Z])(?:选项|项|内容)?$/.exec(header);
  return match?.[1] ?? null;
}

function inspectHeaderRow(row: MatrixRow): HeaderColumns | null {
  let number: number | undefined;
  let type: number | undefined;
  let stem: number | undefined;
  let answer: number | undefined;
  let category: number | undefined;
  const options = new Map<string, number>();

  row.forEach((value, columnIndex) => {
    const header = normalizedHeader(value);
    if (!header) {
      return;
    }

    if (number === undefined && NUMBER_HEADERS.has(header)) {
      number = columnIndex;
      return;
    }
    if (type === undefined && TYPE_HEADERS.has(header)) {
      type = columnIndex;
      return;
    }
    if (stem === undefined && STEM_HEADERS.has(header)) {
      stem = columnIndex;
      return;
    }
    if (answer === undefined && ANSWER_HEADERS.has(header)) {
      answer = columnIndex;
      return;
    }
    if (category === undefined && CATEGORY_HEADERS.has(header)) {
      category = columnIndex;
      return;
    }

    const optionKey = optionKeyFromHeader(value);
    if (optionKey && !options.has(optionKey)) {
      options.set(optionKey, columnIndex);
    }
  });

  if (stem === undefined) {
    return null;
  }

  const supportingFields = [
    number !== undefined,
    type !== undefined,
    answer !== undefined,
    options.size > 0,
  ].filter(Boolean).length;

  if (supportingFields < 1) {
    return null;
  }

  return {
    number,
    type,
    stem,
    answer,
    category,
    options,
  };
}

function readSheetRows(sheet: XLSX.WorkSheet): MatrixRow[] {
  return XLSX.utils.sheet_to_json<MatrixRow>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
}

function scanSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  sheetIndex: number,
): SheetScan {
  const sheet = workbook.Sheets[sheetName];
  const rows = sheet ? readSheetRows(sheet) : [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const columns = inspectHeaderRow(rows[rowIndex]);
    if (columns) {
      return {
        sheetIndex,
        sheetName,
        rows,
        headerRowIndex: rowIndex,
        columns,
      };
    }
  }

  return {
    sheetIndex,
    sheetName,
    rows,
    headerRowIndex: null,
    columns: null,
  };
}

function questionTypeFromSource(value: string): QuestionType | null {
  const normalized = value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("zh-CN");

  if (/单选|单项选择|single/.test(normalized)) {
    return "single";
  }
  if (/多选|多项选择|不定项|multiple/.test(normalized)) {
    return "multiple";
  }
  if (/判断|是非|对错|judge|truefalse/.test(normalized)) {
    return "judge";
  }
  if (/填空|简答|问答|fill/.test(normalized)) {
    return "fill";
  }

  return null;
}

function judgePolarity(value: string): boolean | null {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\s。.，,、;；:：]+/g, "")
    .toLocaleLowerCase("zh-CN");

  if (POSITIVE_JUDGE_VALUES.has(normalized)) {
    return true;
  }
  if (NEGATIVE_JUDGE_VALUES.has(normalized)) {
    return false;
  }
  return null;
}

function deduplicate<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function parseLetterAnswer(value: string): string[] | null {
  const compact = value
    .normalize("NFKC")
    .toUpperCase()
    .replace(/(?:正确答案|标准答案|参考答案|答案)/g, "")
    .replace(/[选项\s,，、;；:：/|+＋和与及或.。()（）[\]【】]/g, "");

  if (!compact || !/^[A-Z]+$/.test(compact)) {
    return null;
  }

  return deduplicate([...compact]);
}

function parseChoiceAnswer(
  rawAnswer: string,
  options: Question["options"],
  type: QuestionType,
): string[] | null {
  const letterAnswer = parseLetterAnswer(rawAnswer);
  if (letterAnswer) {
    return letterAnswer;
  }

  const normalizedAnswer = rawAnswer
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-CN");
  const exactOption = options.find(
    (option) =>
      option.text.normalize("NFKC").trim().toLocaleLowerCase("zh-CN") ===
      normalizedAnswer,
  );
  if (exactOption) {
    return [exactOption.id];
  }

  if (type === "judge") {
    const answerPolarity = judgePolarity(rawAnswer);
    if (answerPolarity !== null) {
      const matchingOption = options.find(
        (option) => judgePolarity(option.text) === answerPolarity,
      );
      if (matchingOption) {
        return [matchingOption.id];
      }
    }
  }

  return null;
}

function inferQuestionType(
  rawAnswer: string,
  options: Question["options"],
): QuestionType {
  if (options.length === 0) {
    return "fill";
  }

  if (options.length <= 2 && judgePolarity(rawAnswer) !== null) {
    return "judge";
  }

  const keys = parseLetterAnswer(rawAnswer);
  return keys && keys.length > 1 ? "multiple" : "single";
}

function parsedQuestionNumber(value: unknown, fallback: number): number {
  const match = cellText(value).match(/\d+/);
  if (!match) {
    return fallback;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isOrderSensitive(
  stem: string,
  options: Question["options"],
): boolean {
  const searchable = [stem, ...options.map((option) => option.text)].join("\n");
  return /(以上(?:选项|各项|说法|答案|均|都)|上述|下列各项中的[ABCD]|[A-EＡ-Ｅ]\s*(?:和|与|及|或|、|,|，|\/|＋|\+)\s*[A-EＡ-Ｅ]|[A-EＡ-Ｅ][项、.．选])/u.test(
    searchable,
  );
}

function suggestedBankName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.(?:xlsx|xls)$/i, "");
  const withoutCopyNumber = withoutExtension.replace(
    /(?:\s*[（(]\s*[0-9０-９]+\s*[）)])+\s*$/u,
    "",
  );
  return withoutCopyNumber.trim() || "未命名题库";
}

function hasSheetContent(scan: SheetScan): boolean {
  return scan.rows.some((row) => row.some((value) => cellText(value).length > 0));
}

function hasSupportedSignature(
  bytes: Uint8Array,
  extension: "xls" | "xlsx",
) {
  if (extension === "xlsx") {
    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(bytes[2]) &&
      [0x04, 0x06, 0x08].includes(bytes[3])
    );
  }

  const oleSignature = [
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
  ];
  return oleSignature.every((value, index) => bytes[index] === value);
}

function assertWorkbookLimits(scans: readonly SheetScan[]) {
  let totalRows = 0;
  let nonEmptyCells = 0;

  for (const scan of scans) {
    totalRows += scan.rows.length;
    for (const row of scan.rows) {
      for (const value of row) {
        const text = cellText(value);
        if (!text) {
          continue;
        }
        nonEmptyCells += 1;
        if (text.length > MAX_CELL_TEXT_LENGTH) {
          throw new Error("文件中存在过长的单元格内容，已停止导入。");
        }
      }
    }
  }

  if (totalRows > MAX_TOTAL_ROWS) {
    throw new Error(`题库文件最多支持 ${MAX_TOTAL_ROWS} 行。`);
  }
  if (nonEmptyCells > MAX_NON_EMPTY_CELLS) {
    throw new Error("题库文件内容过多，已停止导入。");
  }
}

function issueForQuestion(
  issues: ImportIssue[],
  fatalMessages: string[],
  issue: Omit<ImportIssue, "questionId" | "questionNumber">,
  questionId: string,
  questionNumber: number,
  fatal: boolean,
) {
  issues.push({
    ...issue,
    questionId,
    questionNumber,
  });
  if (fatal) {
    fatalMessages.push(issue.message);
  }
}

function parseSheetQuestions({
  scan,
  useSheetCategoryFallback,
  questions,
  categories,
  importIssues,
  nextQuestionId,
  nextCategoryId,
}: {
  scan: SheetScan;
  useSheetCategoryFallback: boolean;
  questions: Question[];
  categories: FileCategory[];
  importIssues: ImportIssue[];
  nextQuestionId: () => string;
  nextCategoryId: () => string;
}) {
  const { columns, headerRowIndex } = scan;
  if (!columns || headerRowIndex === null) {
    return;
  }

  const categoriesInSheet = new Map<string, FileCategory>();
  let activeCategory = "";

  const categoryForName = (name: string): FileCategory => {
    const key = normalizedCategoryKey(name);
    const existing = categoriesInSheet.get(key);
    if (existing) {
      return existing;
    }

    const category: FileCategory = {
      id: nextCategoryId(),
      name,
      questionIds: [],
    };
    categoriesInSheet.set(key, category);
    categories.push(category);
    return category;
  };

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < scan.rows.length;
    rowIndex += 1
  ) {
    const row = scan.rows[rowIndex];
    const rowCategory =
      columns.category === undefined
        ? ""
        : cellText(row[columns.category]);
    if (rowCategory) {
      activeCategory = rowCategory;
    }

    const stem = cellText(row[columns.stem]);
    const rawNumber =
      columns.number === undefined ? "" : row[columns.number];
    const fallbackNumber = questions.length + 1;
    const questionNumber = parsedQuestionNumber(rawNumber, fallbackNumber);

    if (!stem) {
      const rowHasQuestionData = [
        columns.type === undefined ? "" : row[columns.type],
        columns.answer === undefined ? "" : row[columns.answer],
        ...[...columns.options.values()].map(
          (columnIndex) => row[columnIndex],
        ),
      ].some((value) => cellText(value).length > 0);

      if (rowHasQuestionData) {
        importIssues.push({
          code: "missing-stem",
          severity: "error",
          message: `${scan.sheetName} 第 ${rowIndex + 1} 行缺少题干，未导入该行。`,
          questionNumber,
        });
      }
      continue;
    }

    const questionId = nextQuestionId();
    const options = [...columns.options.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([id, columnIndex]) => ({
        id,
        text: cellText(row[columnIndex]),
      }))
      .filter((option) => option.text.length > 0);
    const rawType =
      columns.type === undefined ? "" : cellText(row[columns.type]);
    const rawAnswer =
      columns.answer === undefined ? "" : cellText(row[columns.answer]);
    const sourceType = questionTypeFromSource(rawType);
    const type = sourceType ?? inferQuestionType(rawAnswer, options);
    const fatalMessages: string[] = [];

    if (!sourceType && (rawType || columns.type !== undefined)) {
      issueForQuestion(
        importIssues,
        fatalMessages,
        {
          code: "question-type-inferred",
          severity: "warning",
          message: rawType
            ? `无法识别题型“${rawType}”，已按内容推断为${type}。`
            : `题型为空，已按内容推断为${type}。`,
        },
        questionId,
        questionNumber,
        false,
      );
    }

    let answerKeys: string[] = [];
    let answerText: string | null = null;

    if (type === "fill") {
      answerText = rawAnswer || null;
      if (!rawAnswer) {
        issueForQuestion(
          importIssues,
          fatalMessages,
          {
            code: "missing-answer",
            severity: "error",
            message: "题目缺少答案。",
          },
          questionId,
          questionNumber,
          true,
        );
      }
      if (options.length > 0) {
        issueForQuestion(
          importIssues,
          fatalMessages,
          {
            code: "fill-has-options",
            severity: "warning",
            message: "填空题包含选项，已保留源选项。",
          },
          questionId,
          questionNumber,
          false,
        );
      }
    } else {
      if (options.length === 0) {
        issueForQuestion(
          importIssues,
          fatalMessages,
          {
            code: "missing-options",
            severity: "error",
            message: "选择题或判断题缺少选项。",
          },
          questionId,
          questionNumber,
          true,
        );
      }

      if (!rawAnswer) {
        issueForQuestion(
          importIssues,
          fatalMessages,
          {
            code: "missing-answer",
            severity: "error",
            message: "题目缺少答案。",
          },
          questionId,
          questionNumber,
          true,
        );
      } else {
        const parsedAnswer = parseChoiceAnswer(rawAnswer, options, type);
        if (!parsedAnswer) {
          issueForQuestion(
            importIssues,
            fatalMessages,
            {
              code: "unrecognized-answer",
              severity: "error",
              message: `无法识别答案“${rawAnswer}”。`,
            },
            questionId,
            questionNumber,
            true,
          );
        } else {
          answerKeys = parsedAnswer;
          const optionIds = new Set(options.map((option) => option.id));
          const missingKeys = answerKeys.filter((key) => !optionIds.has(key));
          if (missingKeys.length > 0) {
            issueForQuestion(
              importIssues,
              fatalMessages,
              {
                code: "answer-out-of-range",
                severity: "error",
                message: `答案包含不存在的选项：${missingKeys.join("、")}。`,
              },
              questionId,
              questionNumber,
              true,
            );
          }
        }
      }

      if (type === "single" && answerKeys.length !== 1) {
        issueForQuestion(
          importIssues,
          fatalMessages,
          {
            code: "single-answer-count",
            severity: "error",
            message: `单选题应有一个答案，当前识别到 ${answerKeys.length} 个。`,
          },
          questionId,
          questionNumber,
          true,
        );
      }
      if (type === "judge" && answerKeys.length !== 1) {
        issueForQuestion(
          importIssues,
          fatalMessages,
          {
            code: "judge-answer-count",
            severity: "error",
            message: `判断题应有一个答案，当前识别到 ${answerKeys.length} 个。`,
          },
          questionId,
          questionNumber,
          true,
        );
      }
    }

    const question: Question = {
      id: questionId,
      number: questionNumber,
      sourceRow: rowIndex + 1,
      type,
      stem,
      options,
      answerKeys,
      answerText,
      gradable: fatalMessages.length === 0,
      optionOrderLocked:
        type === "judge" || isOrderSensitive(stem, options),
      sourceIssue:
        fatalMessages.length > 0
          ? deduplicate(fatalMessages).join("；")
          : null,
    };
    questions.push(question);

    const categoryName =
      columns.category !== undefined
        ? activeCategory
        : useSheetCategoryFallback
          ? scan.sheetName
          : "";
    if (categoryName) {
      categoryForName(categoryName).questionIds.push(questionId);
    }
  }
}

/**
 * Parses an Excel question bank entirely in memory. The returned draft is not
 * persisted and can be renamed or reviewed before the caller saves it.
 */
export async function parseQuestionBankFile(
  file: File,
): Promise<ImportedBankDraft> {
  const extensionMatch = /\.(xlsx|xls)$/i.exec(file.name);
  if (!extensionMatch) {
    throw new Error("仅支持 .xls 和 .xlsx 题库文件。");
  }
  if (file.size <= 0) {
    throw new Error("所选文件为空。");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("题库文件不能超过 10 MB。");
  }

  const data = await file.arrayBuffer();
  const extension = extensionMatch[1].toLocaleLowerCase("en") as
    | "xls"
    | "xlsx";
  if (
    !hasSupportedSignature(
      new Uint8Array(data, 0, Math.min(data.byteLength, 8)),
      extension,
    )
  ) {
    throw new Error("文件内容与扩展名不一致，无法导入。");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, {
      type: "array",
      cellDates: false,
      dense: true,
      sheetRows: MAX_TOTAL_ROWS + 1,
    });
  } catch {
    throw new Error("无法读取该 Excel 文件，文件可能已损坏或加密。");
  }
  if (workbook.SheetNames.length > MAX_SHEETS) {
    throw new Error(`题库文件最多支持 ${MAX_SHEETS} 个工作表。`);
  }

  const scans = workbook.SheetNames.map((sheetName, sheetIndex) =>
    scanSheet(workbook, sheetName, sheetIndex),
  );
  assertWorkbookLimits(scans);
  const usableScans = scans.filter(
    (scan) => scan.headerRowIndex !== null && scan.columns !== null,
  );

  if (usableScans.length === 0) {
    throw new Error("未找到可识别的题库表头。");
  }

  const questions: Question[] = [];
  const categories: FileCategory[] = [];
  const importIssues: ImportIssue[] = [];
  let questionSerial = 0;
  let categorySerial = 0;

  for (const scan of scans) {
    if (!scan.columns || scan.headerRowIndex === null) {
      if (hasSheetContent(scan)) {
        importIssues.push({
          code: "sheet-header-not-found",
          severity: "warning",
          message: `工作表“${scan.sheetName}”未找到可识别的题库表头，已跳过。`,
        });
      }
      continue;
    }

    parseSheetQuestions({
      scan,
      useSheetCategoryFallback: usableScans.length > 1,
      questions,
      categories,
      importIssues,
      nextQuestionId: () => {
        questionSerial += 1;
        return `import-q-${String(questionSerial).padStart(6, "0")}`;
      },
      nextCategoryId: () => {
        categorySerial += 1;
        return `file-category-${String(categorySerial).padStart(4, "0")}`;
      },
    });
  }

  if (questions.length === 0) {
    throw new Error("题库表头已识别，但没有找到可导入的题目。");
  }
  if (questions.length > MAX_QUESTIONS) {
    throw new Error(`单个题库最多支持 ${MAX_QUESTIONS} 道题。`);
  }

  return {
    suggestedName: suggestedBankName(file.name),
    sourceFileName: file.name,
    sourceSheets: usableScans.map((scan) => scan.sheetName),
    questions,
    categories,
    importIssues,
  };
}
