"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, type DictionaryKey } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "@/lib/i18n/languages";

const storageKey = "vilm-app-language";

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: DictionaryKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: string | null;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => normalizeLocale(initialLocale));

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setLocaleState(normalizeLocale(stored));
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    function setLocale(nextLocale: SupportedLocale) {
      const normalized = normalizeLocale(nextLocale);
      setLocaleState(normalized);
      window.localStorage.setItem(storageKey, normalized);
    }

    function t(key: DictionaryKey) {
      const dictionary = locale in dictionaries
        ? dictionaries[locale as keyof typeof dictionaries]
        : dictionaries.en;
      return dictionary[key] ?? dictionaries.en[key] ?? key;
    }

    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}
