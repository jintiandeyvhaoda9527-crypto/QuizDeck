# Architecture

QuizDeck separates deterministic learning behavior from optional model access. The same React interface is bundled for the web/PWA and the Capacitor Android shell.

## Main layers

```text
UI screens
  ├─ library, import, practice, exam, review, settings
  └─ AI intent, confirmation, processing, candidate review
        │
Application state
  ├─ active bank and scope
  ├─ answer sessions and progress
  └─ saved partitions and mistake IDs
        │
Domain modules
  ├─ Excel parsing and bank validation
  ├─ deterministic shuffling and grading
  ├─ IndexedDB/local-storage persistence
  └─ AI registry, protocol adapters, discovery, batching and validation
        │
Platform boundary
  ├─ browser storage for web preview
  └─ Capacitor + Android Keystore plugin for Android credentials
```

## AI classification sequence

1. The user enters a natural-language goal for the active bank.
2. The model receives a compact bank summary and returns a short intent summary and suggested partition name.
3. The user confirms or edits that interpreted goal.
4. QuizDeck freezes the active bank ID and sends questions in bounded batches.
5. Every response must match the expected JSON shape.
6. Candidate IDs are restricted to the active bank, deduplicated, and restored to source order.
7. The user reviews the full candidate, changes membership or the name, and explicitly saves or discards it.

Question text is treated as untrusted input inside the model prompt. Instructions found inside a question must not override the classification contract.

## Local persistence

- Imported banks: IndexedDB.
- Preferences, sessions, mistakes, and partitions: browser-compatible local storage.
- Android API key: ciphertext, IV, and a non-secret connection binding in excluded SharedPreferences; AES key in Android Keystore.
- Web-preview API key: a session-storage v2 record with an explicit weaker-security warning; closing the browser session requires re-entry. The record is bound to provider, protocol, and normalized base URL, so settings changed through shared local storage in another tab cannot be paired with this tab's key.
- AI provider settings: the v2 local-storage record contains provider, protocol, base URL, model, timeout, and optional discovery time, but no API key.

Legacy v1 AI settings are migrated on read. An official DeepSeek URL becomes the DeepSeek registry entry; other compatible URLs become the custom entry. Migration reuses the existing platform API-key store rather than copying the secret into settings or creating provider-specific key slots. The current product therefore has one active AI connection and one stored API key, not a multi-account connection vault.

Stored sessions are scoped by both bank ID and bank version. Import validation rejects duplicate IDs, malformed options, invalid answer references, and categories that point outside the bank.

## Provider registry and protocol adapters

The provider registry has 11 entries: OpenAI, DeepSeek, Google Gemini, Alibaba Cloud Model Studio / Qwen, Volcano Engine Ark / Doubao, Zhipu GLM, Moonshot / Kimi, MiniMax for Mainland China, MiniMax Global, xAI / Grok, and a custom OpenAI-compatible service. Each entry declares its protocol, display names, homepage, documentation and API-key links, base URL, discovery mode, fallback model IDs, and whether the base URL is locked.

All official entries use locked, validated API base URLs. This ties the provider selection and key destination together in the configuration UI. The custom entry accepts a normalized user URL, requires HTTPS except for loopback development, and displays the destination before the key is used. Resource URL construction derives `models` and `chat/completions` paths from the saved base URL without accepting credentials, query strings, or fragments in that base.

The protocol-adapter boundary exposes three operations: list models, test one model, and complete chat messages. The first adapter implements the OpenAI-compatible Chat Completions shape. Native Claude Messages, a dedicated Ollama entry, and multiple saved connections are outside this first release; a conforming Ollama or other local service can still use the custom entry through a suitable endpoint.

## Model discovery and connection checks

1. The user selects a provider and enters its API key. Official provider links explain where to obtain the key and how to use the API.
2. On explicit request, the adapter sends one authenticated `GET /models` request. It does not probe every returned model.
3. The parser accepts common top-level and nested `data` or `models` arrays, bounds the response and result count, normalizes IDs, removes duplicates, and conservatively excludes identifiers that clearly represent non-chat workloads.
4. The UI supports text search over the remaining names, IDs, and owners. When enumeration is unsupported, empty, invalid, or unavailable to a browser because of CORS/network policy, it shows provider-specific fallback suggestions when defined and keeps manual model-ID entry available.
5. The user selects one model. Only that final selection receives a small Chat Completions connection check; a successful check is required before settings can be saved.

Neither an upstream list entry nor a built-in fallback is proof of account access, balance, regional availability, or chat compatibility. Fallbacks are conservative navigation hints. A web browser can also fail to read `/models` because the provider does not allow cross-origin requests even though the same credentials and endpoint may work from Android or another non-browser client.

## Provider compatibility and errors

The client uses the OpenAI-compatible chat-completions shape. It supports a provider base URL, model name, bearer API key, and bounded timeout. Provider output extraction accepts common string, text-array, legacy choice-text, and Responses-style shapes, but classification still requires the strict final JSON object.

Web requests use bounded Fetch reads with caller cancellation. Android routes AI traffic through the project-owned `AiHttp` Capacitor plugin: request IDs bind cancellation to an active native connection, redirects are disabled, successful UTF-8 bodies are streamed through the same size ceiling, and non-2xx response bodies are never read. The transport returns only status and safe error categories to TypeScript. Capacitor plugin logging is disabled for all build types so method arguments containing API keys or question content never enter Logcat.

Official DeepSeek endpoints use current fallback suggestions, migrate retired official model names, and disable reasoning for structured classification. Shared transport maps HTTP 401 to invalid credentials, 403 to missing endpoint or model permission, 404/405 to a missing endpoint or model, and 429 to rate limiting. It separately reports browser direct-access failures (commonly CORS or browser network policy) and general network failures. Provider response bodies are deliberately omitted from surfaced errors.

## Trust boundaries

- Imported spreadsheets are untrusted and parsed locally with row and size limits.
- Model output is untrusted and never directly mutates bank questions.
- Provider error bodies are not displayed because they can echo secrets or input data.
- An official registry choice locks the API-key destination, but a custom endpoint is an explicit trust decision: that server receives the key and receives question content after the user confirms an AI classification workflow.
- Web session storage is accessible to same-origin scripts for the life of the session; Android Keystore protects the key at rest but cannot protect a compromised or unlocked device.
- The client is not an identity, authorization, or enterprise device-management system.
- An intranet deployment still requires the organization to secure transport, endpoints, devices, logs, and model access.
