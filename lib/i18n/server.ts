import "server-only";

import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/languages";
import { dictionaries, type DictionaryKey } from "@/lib/i18n/dictionaries";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function getCurrentAppLocale() {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return DEFAULT_LOCALE;

  const workspace = await getCurrentWorkspace();
  if (!workspace) return DEFAULT_LOCALE;

  const { data, error } = await createAdminClient()
    .from("user_settings")
    .select("app_language")
    .eq("user_id", workspace.user.id)
    .maybeSingle();

  if (error) return DEFAULT_LOCALE;

  return normalizeLocale(data?.app_language);
}

export async function getServerTranslator() {
  const locale = await getCurrentAppLocale();
  const dictionary = locale in dictionaries
    ? dictionaries[locale as keyof typeof dictionaries]
    : dictionaries.en;

  return {
    locale,
    t(key: DictionaryKey) {
      return dictionary[key] ?? dictionaries.en[key] ?? key;
    },
  };
}
