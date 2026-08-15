"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { baseMessages } from "./base-messages";
import { coreMessages } from "./core-messages";
import { libraryMessages } from "./library-messages";
import { quizMessages } from "./quiz-messages";

export type AppLocale = "zh-CN" | "en-US";
export type LocalePreference = "system" | AppLocale;
export type TranslationValues = Record<string, string | number>;

export const LOCALE_STORAGE_KEY = "quizdeck:locale:v1";

const messages: Record<AppLocale, Record<string, string>> = {
  "zh-CN": {
    ...baseMessages["zh-CN"],
    ...libraryMessages["zh-CN"],
    ...quizMessages["zh-CN"],
    ...coreMessages["zh-CN"],
  },
  "en-US": {
    ...baseMessages["en-US"],
    ...libraryMessages["en-US"],
    ...quizMessages["en-US"],
    ...coreMessages["en-US"],
  },
};

interface NativeLocalePlugin {
  getDefaultLocale(): Promise<{ locale?: string }>;
}

const NativeLocale = registerPlugin<NativeLocalePlugin>("AppLocale");

function normalizeLocale(value: string | null | undefined): AppLocale | null {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  if (normalized.startsWith("en")) {
    return "en-US";
  }
  return null;
}

function normalizePreference(
  value: string | null | undefined,
): LocalePreference | null {
  return value === "system" ? value : normalizeLocale(value);
}

export function detectSystemLocale(): AppLocale {
  if (typeof globalThis.navigator === "undefined") {
    return "zh-CN";
  }
  for (const value of globalThis.navigator.languages ?? []) {
    const locale = normalizeLocale(value);
    if (locale) {
      return locale;
    }
  }
  return normalizeLocale(globalThis.navigator.language) ?? "zh-CN";
}

function subscribeSystemLocale(onStoreChange: () => void) {
  globalThis.addEventListener?.("languagechange", onStoreChange);
  return () => globalThis.removeEventListener?.("languagechange", onStoreChange);
}

export function translate(
  locale: AppLocale,
  key: string,
  values: TranslationValues = {},
) {
  const template = messages[locale][key] ?? messages["zh-CN"][key] ?? key;
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/gu, (_, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : `{{${name}}}`,
  );
}

interface I18nValue {
  locale: AppLocale;
  preference: LocalePreference;
  setPreference: (value: LocalePreference) => void;
  t: (key: string, values?: TranslationValues) => string;
}

const defaultValue: I18nValue = {
  locale: "zh-CN",
  preference: "system",
  setPreference: () => undefined,
  t: (key, values) => translate("zh-CN", key, values),
};

const I18nContext = createContext<I18nValue>(defaultValue);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<LocalePreference>("system");
  const systemLocale = useSyncExternalStore(
    subscribeSystemLocale,
    detectSystemLocale,
    (): AppLocale => "zh-CN",
  );

  useEffect(() => {
    let cancelled = false;

    async function hydratePreference() {
      let stored: LocalePreference | null = null;
      try {
        stored = normalizePreference(
          globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY),
        );
      } catch {
        // The in-memory preference remains usable when storage is unavailable.
      }
      if (stored) {
        if (!cancelled) {
          setPreferenceState(stored);
        }
        return;
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const result = await NativeLocale.getDefaultLocale();
          const nativeDefault = normalizeLocale(result.locale);
          if (!cancelled && nativeDefault) {
            setPreferenceState(nativeDefault);
          }
        } catch {
          // System language remains the fallback if the native flavor is absent.
        }
      }
    }

    void hydratePreference();
    return () => {
      cancelled = true;
    };
  }, []);

  const locale = preference === "system" ? systemLocale : preference;

  const setPreference = useCallback((value: LocalePreference) => {
    setPreferenceState(value);
    try {
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, value);
    } catch {
      // The selected language remains active for this run.
    }
  }, []);

  const t = useCallback(
    (key: string, values?: TranslationValues) =>
      translate(locale, key, values),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "app.title");
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, preference, setPreference, t }),
    [locale, preference, setPreference, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
