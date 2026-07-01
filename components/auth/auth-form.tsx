"use client";

import { ArrowRight, Eye, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register" | "forgot" | "reset";

function getAuthErrorMessage(message: string, t: (key: DictionaryKey) => string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return t("auth.invalidCredentials");
  if (lower.includes("email not confirmed")) return t("auth.emailNotConfirmed");
  if (lower.includes("password")) return t("auth.passwordInvalid");
  if (lower.includes("already registered") || lower.includes("already exists")) return t("auth.alreadyRegistered");
  if (lower.includes("invalid")) return t("auth.invalidInput");
  return message || t("auth.genericError");
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const next = searchParams.get("next") || "/dashboard";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  async function handleGoogle() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      setLoading(false);
      setError(getAuthErrorMessage(oauthError instanceof Error ? oauthError.message : t("auth.googleError"), t));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        router.push(next);
        router.refresh();
        return;
      }

      if (mode === "register") {
        const { error: registerError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
          },
        });
        if (registerError) throw registerError;
        setSuccess(t("auth.registerSuccess"));
        return;
      }

      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${appUrl}/reset-password`,
        });
        if (resetError) throw resetError;
        setSuccess(t("auth.resetSent"));
        return;
      }

      if (mode === "reset") {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setSuccess(t("auth.passwordUpdated"));
        router.push("/login");
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError instanceof Error ? authError.message : t("auth.genericError"), t));
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  return (
    <div className="mt-8">
      {(isLogin || isRegister) ? (
        <>
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            <span className="flex size-5 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900">G</span>
            {t("auth.continueGoogle")}
          </Button>
          <div className="my-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("auth.orEmail")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      {error ? <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="mb-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{success}</div> : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isRegister ? (
          <div>
            <label htmlFor="fullName" className="mb-2 block text-sm font-medium">{t("auth.fullName")}</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="fullName" name="fullName" className="h-11 pl-10" required minLength={2} />
            </div>
          </div>
        ) : null}

        {!isReset ? (
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">{t("auth.email")}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" name="email" type="email" className="h-11 pl-10" required />
            </div>
          </div>
        ) : null}

        {!isForgot ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">{isReset ? t("auth.newPassword") : t("auth.password")}</label>
              {isLogin ? <Link href="/forgot-password" className="text-xs font-medium text-primary">{t("auth.forgotPassword")}</Link> : null}
            </div>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" name="password" type="password" className="h-11 px-10" required minLength={6} />
              <Eye className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        ) : null}

        <Button size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          {isLogin ? t("auth.loginButton") : isRegister ? t("auth.registerButton") : isForgot ? t("auth.sendResetLink") : t("auth.updatePassword")}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {isLogin ? <>{t("auth.noAccount")} <Link href="/register" className="text-primary">{t("auth.createAccount")}</Link></> : null}
        {isRegister ? <>{t("auth.hasAccount")} <Link href="/login" className="text-primary">{t("auth.loginLink")}</Link></> : null}
        {(isForgot || isReset) ? <Link href="/login" className="text-primary">{t("auth.backToLogin")}</Link> : null}
      </p>
    </div>
  );
}
