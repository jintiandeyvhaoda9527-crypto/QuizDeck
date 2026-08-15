import { rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = {
  "android-assets": resolve(
    projectRoot,
    "android/app/src/main/assets/public",
  ),
  "mobile-output": resolve(projectRoot, "android-web"),
};
const targetName = process.argv[2];
const target = targets[targetName];

if (!target) {
  throw new Error("Unknown generated mobile asset target.");
}

const relativeTarget = relative(projectRoot, target);
if (
  !relativeTarget ||
  relativeTarget.startsWith("..") ||
  isAbsolute(relativeTarget)
) {
  throw new Error("Refusing to clean outside the project.");
}

await rm(target, {
  force: true,
  maxRetries: 3,
  recursive: true,
  retryDelay: 100,
});
