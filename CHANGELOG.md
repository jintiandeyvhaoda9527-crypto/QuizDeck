# Changelog

All notable changes are documented here. This project follows Semantic Versioning while it is practical for the pre-1.0 API.

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
