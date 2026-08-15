# Contributing to QuizDeck

Thank you for helping improve enterprise learning tools that can run locally.

## Before opening an issue

Search existing issues and confirm the problem on the latest release. Use the closest issue template. Provider and import bugs should include the smallest synthetic fixture that reproduces the behavior.

Never attach credentials, signing files, private policies, employee data, or a complete organizational question bank. Redacting a screenshot is not enough if the underlying file remains attached.

## Development setup

```bash
pnpm install
pnpm run verify
```

Android changes also require JDK 21, Android SDK 36, and Android Build Tools 35:

```powershell
pnpm run android:sync
cd android
./gradlew :app:assembleDebug
```

On Windows, use `gradlew.bat`.

## Pull requests

Keep each pull request focused and link it to an issue when practical. Describe user impact, privacy impact, tests, and migration behavior. UI changes should include screenshots at narrow and standard phone widths. New strings must be added to every supported locale.

All fixtures must be original, synthetic, public-domain, or covered by a compatible license with attribution. Do not paste provider output that contains user data.

Before requesting review:

1. Run `pnpm run verify`.
2. Build the affected Android variant when native or mobile behavior changed.
3. Check staged files and generated assets.
4. Confirm that no secret or private dataset is present.
5. Update documentation and `CHANGELOG.md` for user-visible changes.

## Design principles

- Keep ordinary learning offline and usable without AI.
- Treat AI as optional and its output as untrusted.
- Require human review before an AI candidate changes saved partitions.
- Prefer small, testable domain modules over UI-bound logic.
- Preserve original questions, IDs, and order unless the user explicitly requests a presentation shuffle.
- Avoid adding accounts, analytics, cloud sync, or administrative services without a separately reviewed design.
