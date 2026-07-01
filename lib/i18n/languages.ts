export const DEFAULT_LOCALE = "en";

export const supportedLocales = ["en", "ro", "ru", "fr"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

const languageNames: Record<SupportedLocale, string> = {
  en: "English",
  ro: "Romanian",
  ru: "Russian",
  fr: "French",
};

export function normalizeLocale(value?: string | null): SupportedLocale {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (supportedLocales.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale;
  }

  return DEFAULT_LOCALE;
}

export function getLanguageName(value?: string | null) {
  return languageNames[normalizeLocale(value)];
}
