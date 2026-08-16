import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Android disables application-data backup", async () => {
  const [manifest, legacyRules, extractionRules] = await Promise.all([
    readFile(
      new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../android/app/src/main/res/xml/backup_rules.xml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../android/app/src/main/res/xml/data_extraction_rules.xml",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /android:allowBackup="true"/);
  for (const domain of [
    "root",
    "file",
    "database",
    "sharedpref",
    "external",
    "device_root",
    "device_file",
    "device_database",
    "device_sharedpref",
  ]) {
    const exclusion = new RegExp(`<exclude domain="${domain}" path="\\." \\/>`);
    assert.match(legacyRules, exclusion);
    assert.equal(extractionRules.match(new RegExp(exclusion.source, "g"))?.length, 2);
  }
});

test("repository ignores common service and signing secrets", async () => {
  const [rootIgnore, androidIgnore] = await Promise.all([
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../android/.gitignore", import.meta.url), "utf8"),
  ]);

  for (const pattern of ["google-services.json", "*.p12", "*.pfx", "key.properties"]) {
    assert.match(rootIgnore, new RegExp(`^${pattern.replaceAll(".", "\\.").replaceAll("*", ".*")}$`, "m"));
  }
  assert.match(androidIgnore, /^google-services\.json$/m);
});

test("Android build does not load the unused Google Services plugin", async () => {
  const [rootBuild, appBuild] = await Promise.all([
    readFile(new URL("../android/build.gradle", import.meta.url), "utf8"),
    readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(rootBuild, /com\.google\.gms:google-services/);
  assert.doesNotMatch(appBuild, /com\.google\.gms\.google-services/);
});

test("Capacitor never logs native plugin arguments in debug or release builds", async () => {
  const config = await readFile(
    new URL("../capacitor.config.ts", import.meta.url),
    "utf8",
  );

  assert.match(config, /loggingBehavior:\s*"none"/u);
  assert.doesNotMatch(config, /loggingBehavior:\s*"(?:debug|production)"/u);
});

test("Android secure key records commit and clear their connection binding atomically", async () => {
  const plugin = await readFile(
    new URL(
      "../android/app/src/main/java/app/quizdeck/mobile/SecureApiKeyPlugin.java",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(plugin, /\.putString\(CIPHERTEXT,[^\r\n]+\)\s*\.putString\(IV,[^\r\n]+\)\s*\.putString\(CONNECTION_BINDING,[^\r\n]+\)\s*\.commit\(\)/u);
  assert.match(plugin, /\.remove\(CIPHERTEXT\)\s*\.remove\(IV\)\s*\.remove\(CONNECTION_BINDING\)\s*\.commit\(\)/u);
});

test("Android AI HTTP transport is cancellable, bounded, and does not read error bodies", async () => {
  const [plugin, activity, transport] = await Promise.all([
    readFile(
      new URL(
        "../android/app/src/main/java/app/quizdeck/mobile/AiHttpPlugin.java",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../android/app/src/main/java/app/quizdeck/mobile/MainActivity.java",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/ai-transport.ts", import.meta.url), "utf8"),
  ]);

  assert.match(activity, /registerPlugin\(AiHttpPlugin\.class\)/u);
  assert.match(plugin, /ConcurrentHashMap<String, RequestState>/u);
  assert.match(plugin, /state\.cancel\(\)/u);
  assert.match(plugin, /connection\.disconnect\(\)/u);
  assert.match(plugin, /setInstanceFollowRedirects\(false\)/u);
  assert.match(plugin, /MAX_RESPONSE_CHARS = 320_000/u);
  assert.match(plugin, /status < 200 \|\| status >= 300/u);
  assert.doesNotMatch(plugin, /getErrorStream\(/u);
  assert.match(transport, /registerPlugin<NativeAiHttpPlugin>\("AiHttp"\)/u);
  assert.match(transport, /NativeAiHttp\.cancel\(\{ requestId \}\)/u);
});
