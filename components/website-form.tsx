"use client";

import { AlertCircle, ArrowRightLeft, Globe2, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FormErrors {
  name?: string;
  url?: string;
  language?: string;
  niche?: string;
}

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

interface DuplicateWebsiteInfo {
  websiteId: string;
  domain: string;
  canTransfer: boolean;
}

export function WebsiteForm({ canTransferWebsites = false }: { canTransferWebsites?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [duplicate, setDuplicate] = useState<DuplicateWebsiteInfo | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setFieldErrors({});
    setDuplicate(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      url: formData.get("url"),
      language: formData.get("language"),
      niche: formData.get("niche"),
    };

    try {
      const response = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        data?: { id: string };
        error?: string;
        fields?: FormErrors;
        duplicate?: DuplicateWebsiteInfo;
      };

      if (!response.ok) {
        setFieldErrors(result.fields ?? {});
        setDuplicate(result.duplicate ?? null);
        throw new Error(result.error ?? "The website could not be added.");
      }

      const websiteId = result.data?.id;
      router.push(websiteId ? `/crawl?websiteId=${encodeURIComponent(websiteId)}` : "/websites");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransfer() {
    if (!duplicate || isTransferring) return;
    setIsTransferring(true);
    setError("");

    try {
      const response = await fetch("/api/websites/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: duplicate.websiteId,
          domain: duplicate.domain,
        }),
      });
      const result = (await response.json()) as { data?: { id: string }; error?: string };

      if (!response.ok || result.error || !result.data?.id) {
        throw new Error(result.error ?? "The website could not be transferred.");
      }

      router.push(`/dashboard?websiteId=${encodeURIComponent(result.data.id)}`);
      router.refresh();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "The website could not be transferred.");
    } finally {
      setIsTransferring(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
          {canTransferWebsites && duplicate?.canTransfer ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/30 bg-background/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleTransfer}
              disabled={isTransferring}
            >
              {isTransferring ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
              {t("websiteForm.transfer")}
            </Button>
          ) : null}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="website-name">
          {t("websiteForm.name")}
        </label>
        <Input
          id="website-name"
          name="name"
          placeholder={t("websiteForm.namePlaceholder")}
          required
          minLength={2}
          maxLength={120}
          aria-invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="website-url">
          {t("websiteForm.url")}
        </label>
        <div className="relative">
          <Globe2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="website-url"
            name="url"
            placeholder={t("websiteForm.urlPlaceholder")}
            className="pl-10"
            required
            inputMode="url"
            aria-invalid={Boolean(fieldErrors.url)}
          />
        </div>
        {fieldErrors.url ? (
          <p className="mt-1.5 text-xs text-destructive">{fieldErrors.url}</p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("websiteForm.urlHelp")}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="website-language">
            {t("websiteForm.language")}
          </label>
          <select
            id="website-language"
            name="language"
            defaultValue="en"
            className={selectClassName}
            aria-invalid={Boolean(fieldErrors.language)}
          >
            <option value="en">{t("common.english")}</option>
            <option value="ro">{t("common.romanian")}</option>
            <option value="ru">Russian</option>
            <option value="fr">French</option>
          </select>
          {fieldErrors.language && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.language}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="website-niche">
            {t("websiteForm.niche")}
          </label>
          <Input
            id="website-niche"
            name="niche"
            placeholder={t("websiteForm.nichePlaceholder")}
            required
            minLength={2}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.niche)}
          />
          {fieldErrors.niche && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.niche}</p>}
        </div>
      </div>

      <div className="flex justify-end border-t pt-5">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("websiteForm.saving")}
            </>
          ) : (
            <>
              <Plus className="size-4" />
              {t("websiteForm.add")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
