# QuizDeck

<p align="center">
  <img src="public/icons/icon-512.png" alt="QuizDeck 手机应用图标" width="144" height="144" />
</p>

<p align="center"><strong>AI 辅助、隐私优先的企业员工培训与资格考试平台。</strong></p>

[English](README.md)

QuizDeck 是一款 AI 辅助、隐私优先的企业员工培训与资格考试辅助平台。它支持导入 Excel 题库，提供离线练习、随机模拟考试、即时答案反馈、错题强化和学习进度记录，并能把自然语言培训目标转换为可人工复核的题目分区。

当前项目是一个轻量的 Android 与 Web 客户端，适用于岗位培训、合规学习、制度流程、安全要求和资格考试准备，不依赖统一账号或云端数据库。

## 核心能力

- **离线优先：** 导题、答题、判分、进度、错题和分区默认在本机完成。
- **两阶段 AI 分类：** AI 先整理用户意愿，用户确认后，系统才按受控批次筛选当前题库。
- **人工决定结果：** AI 只生成候选分区，用户可增选、取消、改名或放弃，确认后才保存。
- **严格结果边界：** 校验结构、置信度和题目 ID，自动去重并恢复原题顺序。
- **企业部署选择：** 可选择已登记的云端服务商，也可通过自定义 HTTPS 内网网关接入 Ollama、vLLM 等 OpenAI 兼容服务。
- **本地数据所有权：** 题库、答题记录、错题和已保存分区默认留在设备上。

## 当前功能

| 范围 | 已实现 |
| --- | --- |
| 题库 | `.xls` / `.xlsx` 导入、多题库管理、原顺序保留、可删除示例题库 |
| 学习 | 顺序练习、随机练习、即时答案、错题专项、断点续做 |
| 考试 | 随机模拟考试、答题卡、交卷确认、结果复核 |
| AI 分类 | 意愿整理、确认、分批筛选、结构校验、置信度校验、人工复核 |
| 模型配置 | 11 项 OpenAI 兼容服务商注册表、上游模型检测、建议搜索、手工模型 ID 和选中模型连接测试 |
| 语言 | 跟随系统、简体中文或 English，选择结果保存在本机 |
| 平台 | 响应式 Web/PWA，以及由同一份 Capacitor 源码构建的两种 Android 版本 |

语义重复题识别和基于错题的 AI 自适应推荐已列入[路线图](ROADMAP.md)，目前不会宣传为已完成功能。

## 服务商与模型检测

注册表包含 OpenAI、DeepSeek、Google Gemini、阿里云百炼 / 千问、火山方舟 / 豆包、智谱 GLM、Moonshot / Kimi、MiniMax（中国大陆）、MiniMax（国际）、xAI / Grok，以及自定义 OpenAI 兼容服务，共 11 项。官方条目提供服务商主页、API 文档和 API Key 获取链接，并将官方 API 基础地址设为只读且进行一致性校验，避免在设置页把对应密钥改送到其他地址。自定义条目允许填写 HTTPS 基础地址；本机开发仍可使用回环 HTTP 地址。

模型检测由用户主动发起，使用 API Key 请求上游 `GET /models`。QuizDeck 会保守排除明显用于嵌入、图像、语音、审核、重排、实时或转写等非聊天任务的模型 ID，再提供列表搜索；不会逐个调用列表中的模型。如果上游不支持模型枚举、返回空列表或未知格式，或者网页端受到 CORS / 网络策略限制，选择器会在可用时显示该服务商的内置建议，并始终允许手工填写模型 ID。

上游返回的模型和内置 fallback 都只是选择线索，不代表当前账号具有调用权限、余额、区域资格或实际可用性。QuizDeck 只测试用户最终选中的一个模型，并要求连接测试成功后才能保存。HTTP 401、403、404 和 429 会分别提示凭据无效、无访问权限、接口或模型不存在，以及请求限流。

首期注册表统一使用 OpenAI 兼容的 Chat Completions 协议，尚不包含 Claude 原生 Messages 协议、Ollama 专用条目或多套已保存连接。只要符合 QuizDeck 的传输要求，OpenAI 兼容的 Ollama 部署仍可通过自定义地址接入。

## 数据与 AI 边界

AI 为可选能力。配置页只会在用户主动检测模型或测试选中模型时连接服务商，这些请求不包含题库内容。只有用户主动开始 AI 分类并确认系统整理的分类目标后，QuizDeck 才会把当前题库按受控批次发送到用户选择的接口。普通导题、练习、考试、判分和历史记录不会访问 AI 接口。

通过本地或内网模型部署，企业可以让题库内容和学习数据保留在自身网络边界内。Android 与非本机网页连接要求使用 HTTPS，明文 HTTP 只用于本机回环地址开发。官方注册表条目会锁定 API 目标地址；自定义地址会收到用户的 API Key，并在开始 AI 分类后收到题目内容，连接前必须确认该服务器可信。实际安全性仍取决于网络设计、访问权限、接口配置、设备策略和模型部署方式。

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
