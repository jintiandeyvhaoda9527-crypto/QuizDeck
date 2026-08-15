# Android release guide

## Toolchain

- JDK 21
- Android SDK Platform 36
- Android Build Tools 35
- Node.js 22.13+
- pnpm 11.19

## Debug build

```powershell
pnpm install --frozen-lockfile
pnpm run android:apk
```

Two debug APKs are created from the same source. The Chinese-default variant keeps the base application ID for upgrades from v0.1; the English-default variant uses an `.en` suffix. Both retain the in-app language selector:

```text
android/app/build/outputs/apk/zh/debug/app-zh-debug.apk
android/app/build/outputs/apk/en/debug/app-en-debug.apk
```

Use `pnpm run android:apk:zh` or `pnpm run android:apk:en` to build only one variant.

Debug APKs are suitable for local testing. They should not be presented as production-signed releases.

## Production signing

Create and store the signing key outside the repository. Configure Gradle through ignored local properties or CI secrets, then run the release build from a clean tagged commit. Never commit the keystore, passwords, generated `local.properties`, or a rendered signing configuration.

Before publishing:

1. Run `pnpm install --frozen-lockfile` and `pnpm run verify`.
2. Run the repository secret scan across the full Git history.
3. Build the Android release from the tag.
4. Install and exercise import, deletion, practice, exam, AI test, classification cancellation, and configuration clearing.
5. Verify the version name, version code, application ID, icon, and language variant.
6. Generate and publish a SHA-256 checksum next to each APK.
7. Keep signing material and OpenAI/provider organization information outside GitHub artifacts and logs.

## Upgrade policy

Increase `versionCode` for every published Android build. Use Semantic Versioning for `versionName`. Changing `applicationId` creates a different Android application and does not migrate local data.
