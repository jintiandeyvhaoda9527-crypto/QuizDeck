# Privacy

QuizDeck is an offline-first client. It has no bundled analytics service, advertising SDK, user-account backend, or cloud synchronization service.

## Data stored on the device

Depending on the platform, QuizDeck stores imported question banks, answer sessions, progress, mistake IDs, user-created partitions, the selected model settings, and a dismissal flag for the optional demo bank in browser-compatible local storage or IndexedDB.

On Android, the user-provided API key is encrypted before storage with an AES-GCM key generated and protected by Android Keystore. Backup rules exclude the encrypted API-key preference file. Removing the app or clearing its data removes locally stored QuizDeck data according to the operating system's behavior.

The web preview cannot provide Android Keystore protection. Its API key is stored in browser local storage so that the preview can test compatibility. Do not use a high-value production credential in a shared browser profile. Prefer a short-lived, restricted key or the Android build.

## When data leaves the device

Importing a bank, practicing, taking an exam, scoring, and reviewing mistakes do not contact an AI provider.

When a user starts AI classification, QuizDeck first sends a compact bank summary to interpret the natural-language goal. After the user confirms that goal, QuizDeck sends the active bank in bounded batches to the configured OpenAI-compatible endpoint. Requests can include question prompts and choices. QuizDeck does not send stored answer history as part of the current classification flow.

The endpoint operator may log or retain requests according to its own policy. Organizations should evaluate that policy before using an external service.

## Local and intranet deployment

An organization can configure an HTTPS intranet gateway or an OpenAI-compatible local deployment such as Ollama or vLLM. This can keep question content inside the organization's network boundary. Actual security depends on network segmentation, transport security, endpoint authentication, access control, logging, device management, and the model deployment itself.

## Maintainer telemetry

The open-source project does not receive runtime telemetry from installed copies. Information is shared with maintainers only when a user chooses to include it in an issue or discussion. Reports must use synthetic or anonymized examples and must not include credentials, internal documents, employee records, or full private question banks.
