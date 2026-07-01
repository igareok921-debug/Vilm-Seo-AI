import "server-only";

export const SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/search-console/callback`,
  encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
};

export function isGoogleSearchConsoleConfigured() {
  return Boolean(
    googleConfig.clientId &&
      googleConfig.clientSecret &&
      googleConfig.redirectUri &&
      googleConfig.encryptionKey,
  );
}
