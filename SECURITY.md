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
- The web preview uses browser local storage for its user-provided key and has a weaker security boundary than Android.
- QuizDeck validates configured URLs and requires HTTPS except for localhost development endpoints.
- Provider response bodies and user keys are not included in surfaced network errors.
- AI output is treated as untrusted data and must pass structural and bank-membership checks before review.

## Release hygiene

Maintainers must not commit `.env` files, signing stores, `local.properties`, provider credentials, production logs, or private question banks. Release artifacts should be built from a tagged commit, scanned for secrets, signed outside the repository, and published with a SHA-256 checksum.
