import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx";

import { getLibraryErrorMessage } from "../app/i18n/library-messages.ts";
import { parseQuestionBankFile } from "../app/question-bank-import.ts";

function workbookFile(name, sheets, bookType = "xlsx") {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      sheetName,
    );
  }

  const bytes = XLSX.write(workbook, {
    type: "array",
    bookType,
  });
  return new File([bytes], name);
}

function currentSourceRows() {
  const rows = [[
    "序号",
    "题型*",
    "题干*",
    "答案*",
    "选项A",
    "选项B",
    "选项C",
    "选项D",
    "选项E",
  ]];

  for (let number = 1; number <= 24; number += 1) {
    if (number <= 8) {
      rows.push([
        number,
        "单选题",
        `单选题 ${number}`,
        "A",
        "正确项",
        "干扰项 B",
        "干扰项 C",
        "干扰项 D",
        "",
      ]);
      continue;
    }

    if (number <= 14) {
      rows.push([
        number,
        "多选题",
        `多选题 ${number}`,
        number === 14 ? "ABCDE" : "AC",
        "选项 A",
        "选项 B",
        "选项 C",
        "选项 D",
        "",
      ]);
      continue;
    }

    if (number <= 20) {
      rows.push([
        number,
        "判断题",
        `判断题 ${number}`,
        "A",
        "正确",
        "错误",
        "",
        "",
        "",
      ]);
      continue;
    }

    rows.push([
      number,
      "填空题",
      `填空题 ${number}`,
      `答案 ${number}`,
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  return rows;
}

test("parses a synthetic XLS matrix and reports an invalid answer option", async () => {
  const file = workbookFile(
    "员工培训示例题库 (1).xls",
    [["题目", currentSourceRows()]],
    "biff8",
  );

  const draft = await parseQuestionBankFile(file);
  const counts = Object.fromEntries(
    ["single", "multiple", "judge", "fill"].map((type) => [
      type,
      draft.questions.filter((question) => question.type === type).length,
    ]),
  );

  assert.equal(
    draft.suggestedName,
    "员工培训示例题库",
  );
  assert.equal(draft.sourceFileName, file.name);
  assert.deepEqual(draft.sourceSheets, ["题目"]);
  assert.equal(draft.questions.length, 24);
  assert.deepEqual(counts, {
    single: 8,
    multiple: 6,
    judge: 6,
    fill: 4,
  });
  assert.equal(new Set(draft.questions.map((question) => question.id)).size, 24);
  assert.deepEqual(draft.categories, []);

  const sourceIssue = draft.questions.find(
    (question) => question.number === 14,
  );
  assert.ok(sourceIssue);
  assert.equal(sourceIssue.gradable, false);
  assert.deepEqual(sourceIssue.answerKeys, ["A", "B", "C", "D", "E"]);
  assert.match(sourceIssue.sourceIssue ?? "", /不存在的选项：E/);
  assert.ok(
    draft.importIssues.some(
      (issue) =>
        issue.code === "answer-out-of-range" && issue.questionNumber === 14,
    ),
  );

  assert.equal(
    draft.questions.find((question) => question.type === "judge")
      ?.optionOrderLocked,
    true,
  );
  assert.equal(
    draft.questions.find((question) => question.type === "fill")?.answerText,
    "答案 21",
  );
});

test("preserves sheet, category and question order across multiple XLSX sheets", async () => {
  const file = workbookFile("分类题库（2）.xlsx", [
    [
      "制度",
      [
        ["题库标题"],
        ["序号", "题型", "题干", "答案", "A", "B", "C", "分类"],
        [1, "单选", "第一题", "A", "甲", "乙", "丙", "安全"],
        [2, "多选", "第二题", "A、C", "甲", "乙", "丙", ""],
        [3, "判断", "第三题", "正确", "正确", "错误", "", "岗位规范"],
      ],
    ],
    [
      "第二章",
      [
        ["题号", "类型", "题目", "参考答案", "选项A", "B选项"],
        [1, "填空", "第四题", "填空答案", "", ""],
        [2, "单选", "A和B均属于哪一类？", "B", "甲", "乙"],
      ],
    ],
  ]);

  const draft = await parseQuestionBankFile(file);

  assert.equal(draft.suggestedName, "分类题库");
  assert.deepEqual(draft.sourceSheets, ["制度", "第二章"]);
  assert.deepEqual(
    draft.questions.map((question) => question.stem),
    ["第一题", "第二题", "第三题", "第四题", "A和B均属于哪一类？"],
  );
  assert.deepEqual(
    draft.categories.map((category) => category.name),
    ["安全", "岗位规范", "第二章"],
  );
  assert.deepEqual(
    draft.categories.map((category) => category.questionIds.length),
    [2, 1, 2],
  );
  assert.equal(
    draft.categories[0].questionIds[1],
    draft.questions[1].id,
    "blank category cells inherit the preceding file category",
  );
  assert.equal(draft.questions[2].type, "judge");
  assert.deepEqual(draft.questions[2].answerKeys, ["A"]);
  assert.equal(draft.questions[2].optionOrderLocked, true);
  assert.equal(draft.questions[4].optionOrderLocked, true);
  assert.equal(new Set(draft.questions.map((question) => question.id)).size, 5);
});

test("parses fully synthetic English headers, types, options and judge values", async () => {
  const file = workbookFile("Enterprise Training Bank (2).xlsx", [
    [
      "Compliance",
      [
        [
          "Number",
          "Type",
          "Question",
          "Correct Answer",
          "Option A",
          "Option B",
          "Option C",
          "Category",
        ],
        [
          1,
          "Single Choice",
          "Which badge is required in the controlled area?",
          "B",
          "Visitor badge",
          "Authorized employee badge",
          "No badge",
          "Access Control",
        ],
        [
          2,
          "Multiple Choice",
          "Which actions are required before maintenance?",
          "Correct Answer: Option A and Option C",
          "Isolate the equipment",
          "Skip the checklist",
          "Verify zero energy",
          "",
        ],
        [
          3,
          "True or False",
          "A blocked emergency exit must be reported immediately.",
          "True",
          "True",
          "False",
          "",
          "Emergency Response",
        ],
        [
          4,
          "Fill in the Blank",
          "Enter the synthetic drill code.",
          "DRILL-204",
          "",
          "",
          "",
          "",
        ],
      ],
    ],
    [
      "Operations",
      [
        [
          "No.",
          "Type",
          "Prompt",
          "Answer",
          "A Option",
          "B Option",
          "Section",
        ],
        [
          5,
          "True or False",
          "A pre-shift inspection can be omitted.",
          "No",
          "Yes",
          "No",
          "Daily Operations",
        ],
        [
          6,
          "True or False",
          "The synthetic alarm is active.",
          "False",
          "True",
          "False",
          "",
        ],
        [
          7,
          "True or False",
          "The synthetic checklist is complete.",
          "Yes",
          "Yes",
          "No",
          "",
        ],
      ],
    ],
    [
      "Topics",
      [
        [
          "Number",
          "Type",
          "Question",
          "Answer",
          "Option A",
          "Option B",
          "Topic",
        ],
        [
          8,
          "Single Choice",
          "Which team owns the synthetic procedure?",
          "Operations",
          "Operations",
          "Sales",
          "Procedure Ownership",
        ],
      ],
    ],
  ]);

  const draft = await parseQuestionBankFile(file);

  assert.equal(draft.suggestedName, "Enterprise Training Bank");
  assert.deepEqual(draft.sourceSheets, [
    "Compliance",
    "Operations",
    "Topics",
  ]);
  assert.deepEqual(
    draft.questions.map((question) => question.type),
    [
      "single",
      "multiple",
      "judge",
      "fill",
      "judge",
      "judge",
      "judge",
      "single",
    ],
  );
  assert.deepEqual(draft.questions[1].answerKeys, ["A", "C"]);
  assert.deepEqual(
    draft.questions.slice(2, 7).map((question) => question.answerKeys),
    [["A"], [], ["B"], ["B"], ["A"]],
  );
  assert.equal(draft.questions[3].answerText, "DRILL-204");
  assert.deepEqual(
    draft.categories.map((category) => category.name),
    [
      "Access Control",
      "Emergency Response",
      "Daily Operations",
      "Procedure Ownership",
    ],
  );
  assert.deepEqual(
    draft.categories.map((category) => category.questionIds.length),
    [2, 2, 3, 1],
  );
  assert.equal(draft.importIssues.length, 0);
  assert.ok(draft.questions.every((question) => question.gradable));
});

test("keeps answer anomalies as ungradable questions and reports malformed rows", async () => {
  const file = workbookFile("异常题库.xlsx", [
    [
      "题目",
      [
        [
          "编号",
          "试题类型",
          "题目内容",
          "标准答案",
          "选项A",
          "选项B",
          "章节",
        ],
        [1, "单选题", "缺少答案", "", "甲", "乙", "第一章"],
        [2, "单选题", "答案越界", "Z", "甲", "乙", ""],
        [3, "单选题", "单选多个答案", "AB", "甲", "乙", ""],
        [4, "未知类型", "推断题型", "答案文本", "", "", "第二章"],
        [5, "单选题", "", "A", "甲", "乙", ""],
      ],
    ],
  ]);

  const draft = await parseQuestionBankFile(file);

  assert.equal(draft.questions.length, 4);
  assert.deepEqual(
    draft.questions.slice(0, 3).map((question) => question.gradable),
    [false, false, false],
  );
  assert.equal(draft.questions[3].type, "fill");
  assert.equal(draft.questions[3].gradable, true);
  assert.deepEqual(
    new Set(draft.importIssues.map((issue) => issue.code)),
    new Set([
      "missing-answer",
      "answer-out-of-range",
      "single-answer-count",
      "question-type-inferred",
      "missing-stem",
    ]),
  );
  assert.deepEqual(
    draft.categories.map((category) => category.name),
    ["第一章", "第二章"],
  );
  assert.equal(draft.categories[0].questionIds.length, 3);
  assert.equal(draft.categories[1].questionIds.length, 1);
});

test("accepts a minimal fill-only sheet and full-width copy suffix", async () => {
  const file = workbookFile("简答题库（１２）.xlsx", [
    [
      "简答",
      [
        ["题干", "答案"],
        ["最小表头也应识别", "标准答案"],
      ],
    ],
  ]);

  const draft = await parseQuestionBankFile(file);

  assert.equal(draft.suggestedName, "简答题库");
  assert.equal(draft.questions.length, 1);
  assert.equal(draft.questions[0].type, "fill");
  assert.equal(draft.questions[0].answerText, "标准答案");
  assert.equal(draft.questions[0].gradable, true);
  assert.deepEqual(draft.categories, []);
});

test("rejects unsupported files and workbooks without a recognizable header", async () => {
  const textFile = new File(["not an excel workbook"], "题库.csv");
  await assert.rejects(
    parseQuestionBankFile(textFile),
    (error) => {
      assert.equal(error.name, "QuestionBankImportError");
      assert.equal(error.code, "unsupported-file-type");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "Only .xls and .xlsx question-bank files are supported.",
      );
      assert.equal(
        getLibraryErrorMessage("zh-CN", error),
        "仅支持 .xls 和 .xlsx 题库文件。",
      );
      return true;
    },
  );

  const workbook = workbookFile("无表头.xlsx", [
    ["说明", [["这只是说明"], ["没有题库表头"]]],
  ]);
  await assert.rejects(
    parseQuestionBankFile(workbook),
    (error) => {
      assert.equal(error.name, "QuestionBankImportError");
      assert.equal(error.code, "header-not-found");
      assert.equal(
        getLibraryErrorMessage("en-US", error),
        "No recognizable question-bank header was found.",
      );
      return true;
    },
  );
});
