# Changelog

All notable changes are documented here. This project follows Semantic Versioning while it is practical for the pre-1.0 API.

## Unreleased

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
