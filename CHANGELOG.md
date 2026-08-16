# Changelog

All notable changes are documented here. This project follows Semantic Versioning while it is practical for the pre-1.0 API.

## Unreleased

### Added

- An 11-entry OpenAI-compatible provider registry covering OpenAI, DeepSeek, Google Gemini, Alibaba Cloud Model Studio / Qwen, Volcano Engine Ark / Doubao, Zhipu GLM, Moonshot / Kimi, MiniMax for Mainland China and global accounts, xAI / Grok, and a custom endpoint.
- Locked official API base URLs plus provider homepage, API documentation, and API-key links; only the custom provider accepts a user-entered endpoint.
- On-demand upstream model discovery through authenticated `GET /models`, conservative text-chat filtering, model search, provider-specific built-in suggestions, and manual model-ID entry.
- A single-model connection check that tests only the model selected by the user instead of probing every discovered model.

### Changed

- Legacy v1 AI settings migrate to the provider-aware v2 schema while retaining the existing API key in the same platform key store; QuizDeck still saves one active AI connection and one key.
- Authentication, permission, missing endpoint/model, and rate-limit failures now have distinct guidance for HTTP 401, 403, 404, and 429 responses, with separate browser CORS/direct-access and general network messages.
- The AI configuration screen now uses a platform-native UI font stack with standard weights and more readable label, helper-text, and model-list spacing on desktop and narrow screens.

### Security

- Official provider selections validate and lock the key destination. Custom endpoints display an explicit warning because the configured server receives the API key and, during AI classification, question-bank content.
- API keys remain session-only in the web preview and Android Keystore-backed on Android.
- Web-preview key records are bound to their provider, protocol, and endpoint so shared settings changed by another browser tab cannot redirect a tab's session key. Unbound legacy web-session keys require re-entry.
- Android AI requests use a cancellable native transport that disables redirects, bounds successful response reads, and never exposes provider error bodies.
- Capacitor native plugin logging is disabled in every Android build so API keys and AI request content are not written to Logcat during debug sessions.

### Notes

- A model returned by `/models`, or shown as a built-in fallback, is not proof that the current account can use it. Users must select a model and pass its connection check before saving.
- Browser discovery can fail because an upstream service does not permit cross-origin requests even when the endpoint and credentials otherwise work.
- This first provider-registry release does not include the native Claude Messages protocol, a dedicated Ollama provider entry, or multiple saved AI connections.

## 0.2.1 - 2026-08-16

### Added

- App-icon branding in both README files and a repository social-preview image.
- Regression checks for Android backup policy, signing/service-file ignores, and loopback metadata URLs.

### Fixed

- GitHub Actions dependency installation under pnpm 11 by replacing the removed build-script allowlist format with exact-version approvals.
- HTTP 402, 422, 5xx, and DeepSeek resource-exhaustion errors now produce distinct, localized, actionable messages without exposing provider response bodies.
- Local development on `127.0.0.1` no longer emits broken HTTPS icon and manifest URLs.
- User-facing import and local-bank errors now follow the selected Chinese or English interface language.

### Security

- Android cloud backup and device-transfer rules now exclude all application data domains, with application backup disabled.
- Common signing and service configuration files are ignored, and the unused Google Services build plugin has been removed.
- GitHub Actions checkout no longer persists repository credentials into job worktrees.
- Security documentation now accurately describes session-only API-key storage in the web preview and the HTTPS requirement for non-loopback model endpoints.

## 0.2.0 - 2026-08-16

### Added

- Complete Simplified Chinese and English interface with system-language detection and a saved in-app preference.
- Chinese-default and English-default Android build variants from the same source.
- English Excel headers, question types, option labels, choice answers, and true/false values.
- Localized two-stage AI intent interpretation, partition prompts, output language, and user-facing errors.

### Changed

- The web preview now keeps the user-provided API key in session storage and clears the legacy persistent value.
- Android version code and package version advanced for the bilingual release.

## 0.1.0 - 2026-08-16

### Added

- Offline-first Excel question-bank import and multi-bank local storage.
- Sequential practice, shuffled practice, mock exams, instant feedback, mistake review, and saved sessions.
- Two-stage AI classification with batching, strict result validation, source-order restoration, confidence checks, and human review.
- User-configurable OpenAI-compatible model endpoint and Android Keystore-backed API-key storage.
- Current DeepSeek V4 preset, legacy DeepSeek model migration, disabled thinking for structured requests, and actionable provider errors.
- Original 16-question bilingual demo bank that users can permanently remove.
- Web/PWA and Capacitor Android build targets.
- Tests for quiz logic, import parsing, local storage, provider transport, AI workflows, and secret-safe errors.
