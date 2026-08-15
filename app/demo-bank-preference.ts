export const DEMO_BANK_DISMISSED_STORAGE_KEY =
  "quizdeck:demo-bank-dismissed:v1";

export interface DemoBankPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): DemoBankPreferenceStorage {
  if (!globalThis.localStorage) {
    throw new Error("当前环境无法保存示例题库设置");
  }
  return globalThis.localStorage;
}

export function isDemoBankDismissed(
  storage: DemoBankPreferenceStorage = getDefaultStorage(),
) {
  try {
    return storage.getItem(DEMO_BANK_DISMISSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissDemoBank(
  storage: DemoBankPreferenceStorage = getDefaultStorage(),
) {
  try {
    storage.setItem(DEMO_BANK_DISMISSED_STORAGE_KEY, "1");
  } catch {
    throw new Error("无法保存示例题库的删除状态");
  }
}
