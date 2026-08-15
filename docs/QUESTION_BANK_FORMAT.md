# Excel question-bank format

QuizDeck accepts `.xls` and `.xlsx` files. Parsing happens in the client, and importing a file does not require an AI connection.

## Recommended columns

| Meaning | Example header |
| --- | --- |
| Number | `序号`, `题号`, `No`, or `Number` |
| Type | `题型`, `类型`, or `Type` |
| Prompt | `题干`, `题目`, `Question`, or `Prompt` |
| Answer | `答案`, `参考答案`, `Answer`, or `Correct Answer` |
| Options | `选项A`, `A选项`, `Option A`, or `A Option` |
| Category | `分类`, `章节`, `知识点`, `Category`, `Section`, or `Topic` |

The importer locates a recognizable header row on each sheet. Blank rows are ignored. Multiple sheets retain workbook order. A category can come from a category column or, when no category column is present, from the sheet name.

## Supported types

- `单选` / `单选题`
- `多选` / `多选题`
- `判断` / `判断题`
- `填空` / `填空题`
- `Single Choice`
- `Multiple Choice`
- `True or False` / `Judge`
- `Fill in the Blank`

## Answers

Choice answers may use letters such as `A`, `AC`, `A、C`, `Option A and Option C`, or equivalent separators. A choice question whose answer points to a missing option is retained for review but marked ungradable. Fill answers are normalized for surrounding whitespace and common punctuation during grading.

Judge questions accept Chinese values as well as `True`, `False`, `Yes`, and `No`. They keep their option order because swapping true and false can make the source answer misleading.

## Minimal example

| 序号 | 题型 | 题干 | 答案 | 选项A | 选项B | 分类 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 单选 | 哪项属于安全密码做法？ | B | 多人共用 | 唯一强密码 | 信息安全 |
| 2 | 判断 | AI 候选分类保存前应人工复核。 | A | 正确 | 错误 | 合规学习 |
| 3 | 填空 | 结构化文本格式是 ____。 | JSON | | | 数字技能 |

Use only original, synthetic, public-domain, or properly licensed example content in repository contributions.
