# Security Policy

## Supported versions

Security fixes are provided for the latest tagged release. Pre-release branches may change without compatibility guarantees.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature for the repository. If that feature is temporarily unavailable, contact the maintainer through a private channel listed on the maintainer's public GitHub profile.

Do not open a public issue containing:

- API keys, access tokens, signing materials, or authentication headers;
- internal question-bank content, policies, or employee information;
- a working exploit against a public deployment;
- logs that have not been reviewed and redacted.

Include the affected version or commit, platform, impact, minimal reproduction, and any suggested mitigation. Synthetic data is preferred. Maintainers will acknowledge a complete report when practicable, assess severity, and coordinate disclosure after a fix is available.

## Security boundaries

- The Android API key is encrypted using an Android Keystore-backed key. This reduces exposure at rest but does not protect a fully compromised or unlocked device.
- The web preview keeps its user-provided key in browser session storage and has a weaker security boundary than Android because same-origin scripts can access it during that session. The session key record is bound to the selected provider, protocol, and endpoint; a mismatch with cross-tab shared settings is rejected rather than recombined.
- Official provider entries lock and validate their API base URL. Custom URLs require HTTPS except for localhost development endpoints, but HTTPS does not establish that a custom operator is trustworthy.
- Model discovery sends the API key to the configured server in an authenticated `GET /models` request. Testing sends a small prompt only to the selected model; discovery does not test every returned or suggested model.
- A custom server receives the API key and, after the user confirms an AI classification workflow, question-bank content. Users must verify the destination and operator before connecting.
- Provider response bodies and user keys are not included in surfaced network errors.
- Android AI HTTP requests use a project-owned native plugin so cancellation disconnects the underlying connection; redirects are disabled, successful bodies are read through a fixed limit, and non-success bodies are not read.
- AI output is treated as untrusted data and must pass structural and bank-membership checks before review.

## Release hygiene

Maintainers must not commit `.env` files, signing stores, `local.properties`, provider credentials, production logs, or private question banks. Capacitor plugin logging stays disabled in debug and release builds because native method arguments may contain API keys or question content. Release artifacts should be built from a tagged commit, scanned for secrets, signed outside the repository, and published with a SHA-256 checksum.
