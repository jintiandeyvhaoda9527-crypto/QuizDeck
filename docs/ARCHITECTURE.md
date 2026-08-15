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
  └─ AI configuration, transport, batching and result validation
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
- Android API key: ciphertext and IV in excluded SharedPreferences; AES key in Android Keystore.
- Web-preview API key: local storage with an explicit weaker-security warning.

Stored sessions are scoped by both bank ID and bank version. Import validation rejects duplicate IDs, malformed options, invalid answer references, and categories that point outside the bank.

## Provider compatibility

The client uses the OpenAI-compatible chat-completions shape. It supports a provider base URL, model name, bearer API key, and bounded timeout. Provider output extraction accepts common string, text-array, legacy choice-text, and Responses-style shapes, but classification still requires the strict final JSON object.

Official DeepSeek endpoints use a current model preset, migrate retired official model names, disable reasoning for structured classification, and distinguish authentication, balance, parameter, rate-limit, and transient resource errors.

## Trust boundaries

- Imported spreadsheets are untrusted and parsed locally with row and size limits.
- Model output is untrusted and never directly mutates bank questions.
- Provider error bodies are not displayed because they can echo secrets or input data.
- The client is not an identity, authorization, or enterprise device-management system.
- An intranet deployment still requires the organization to secure transport, endpoints, devices, logs, and model access.
