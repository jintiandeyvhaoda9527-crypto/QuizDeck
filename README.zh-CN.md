# QuizDeck

[English](README.md)

QuizDeck 是一款 AI 辅助、隐私优先的企业员工培训与资格考试辅助平台。它支持导入 Excel 题库，提供离线练习、随机模拟考试、即时答案反馈、错题强化和学习进度记录，并能把自然语言培训目标转换为可人工复核的题目分区。

当前项目是一个轻量的 Android 与 Web 客户端，适用于岗位培训、合规学习、制度流程、安全要求和资格考试准备，不依赖统一账号或云端数据库。

## 核心能力

- **离线优先：** 导题、答题、判分、进度、错题和分区默认在本机完成。
- **两阶段 AI 分类：** AI 先整理用户意愿，用户确认后，系统才按受控批次筛选当前题库。
- **人工决定结果：** AI 只生成候选分区，用户可增选、取消、改名或放弃，确认后才保存。
- **严格结果边界：** 校验结构、置信度和题目 ID，自动去重并恢复原题顺序。
- **企业部署选择：** 可配置兼容的云端接口、HTTPS 内网网关，或 Ollama、vLLM 等 OpenAI 兼容服务。
- **本地数据所有权：** 题库、答题记录、错题和已保存分区默认留在设备上。

## 当前功能

| 范围 | 已实现 |
| --- | --- |
| 题库 | `.xls` / `.xlsx` 导入、多题库管理、原顺序保留、可删除示例题库 |
| 学习 | 顺序练习、随机练习、即时答案、错题专项、断点续做 |
| 考试 | 随机模拟考试、答题卡、交卷确认、结果复核 |
| AI 分类 | 意愿整理、确认、分批筛选、结构校验、置信度校验、人工复核 |
| 模型配置 | 自行填写 OpenAI 兼容地址、模型和 API Key；适配当前 DeepSeek V4 并迁移旧模型名 |
| 语言 | 跟随系统、简体中文或 English，选择结果保存在本机 |
| 平台 | 响应式 Web/PWA，以及由同一份 Capacitor 源码构建的两种 Android 版本 |

语义重复题识别和基于错题的 AI 自适应推荐已列入[路线图](ROADMAP.md)，目前不会宣传为已完成功能。

## 数据与 AI 边界

AI 为可选能力。只有用户主动开始 AI 分类并确认系统整理的分类目标后，QuizDeck 才会把当前题库按受控批次发送到用户选择的接口。普通导题、练习、考试、判分和历史记录不会访问 AI 接口。

通过本地或内网模型部署，企业可以让题库内容和学习数据保留在自身网络边界内。实际安全性仍取决于网络设计、访问权限、接口配置、设备策略和模型部署方式。

Android 端使用 Android Keystore 支持的 AES-GCM 密钥加密 API Key。Web 预览只在当前会话存储 API Key，仍不适合保存高敏感凭据；详见 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。

## 本地运行

需要 Node.js 22.13 或更高版本，以及 pnpm 11.19。

```bash
pnpm install
pnpm run dev
pnpm run verify
```

仓库内置少量原创的中英双语通用示例题，覆盖软件使用、信息安全、培训与 AI 复核。示例题库可从题库详情中永久删除。用户导入的题库只保存在本机，不会写入仓库。

## Android APK

需要 JDK 21、Android SDK 36 和 Android Build Tools 35。

```powershell
pnpm run android:apk
```

该命令会构建中文默认版和英文默认版，两种版本都保留应用内语言切换。公开正式版应使用维护者自行保管的签名密钥，签名材料不能提交到仓库。详见 [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md)。

## 题库格式与架构

- Excel 格式说明：[docs/QUESTION_BANK_FORMAT.md](docs/QUESTION_BANK_FORMAT.md)
- 系统架构：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 开发路线：[ROADMAP.md](ROADMAP.md)

## 许可证

QuizDeck 使用 [MIT License](LICENSE)。第三方依赖继续遵循各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
