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
