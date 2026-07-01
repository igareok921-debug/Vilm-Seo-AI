export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

export function isSupabaseAdminConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseConfig.serviceRoleKey);
}

export function isDemoModeAllowed() {
  return !isSupabaseConfigured();
}
