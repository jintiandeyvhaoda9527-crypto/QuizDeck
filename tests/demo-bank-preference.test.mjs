import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_BANK_DISMISSED_STORAGE_KEY,
  dismissDemoBank,
  isDemoBankDismissed,
} from "../app/demo-bank-preference.ts";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("the demo bank stays dismissed after deletion", () => {
  const storage = memoryStorage();
  assert.equal(isDemoBankDismissed(storage), false);

  dismissDemoBank(storage);

  assert.equal(
    storage.getItem(DEMO_BANK_DISMISSED_STORAGE_KEY),
    "1",
  );
  assert.equal(isDemoBankDismissed(storage), true);
});

test("a read failure does not prevent the demo from appearing", () => {
  const storage = {
    getItem() {
      throw new Error("unavailable");
    },
    setItem() {},
  };

  assert.equal(isDemoBankDismissed(storage), false);
});

test("a write failure is reported instead of pretending deletion persisted", () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("full");
    },
  };

  assert.throws(() => dismissDemoBank(storage), /删除状态/);
});
