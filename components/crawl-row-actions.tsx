"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  GitCompare,
  Loader2,
  MoreVertical,
  RefreshCw,
  SearchCode,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { RecentCrawl } from "@/lib/supabase/crawl-data";

type ActionState = "idle" | "rerunning" | "deleting";

interface CrawlStatusPayload {
  data?: {
    status: "pending" | "running" | "completed" | "failed";
    errorMessage?: string | null;
  };
  error?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCrawl(crawlId: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await fetch(`/api/crawl?id=${encodeURIComponent(crawlId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as CrawlStatusPayload;
    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? "Crawl status could not be read.");
    }

    if (payload.data.status === "completed") return;
    if (payload.data.status === "failed") {
      throw new Error(payload.data.errorMessage ?? "The crawl failed.");
    }

    await sleep(2500);
  }

  throw new Error("The crawl is still running. The list will update on the next refresh.");
}

export function CrawlRowActions({ crawl }: { crawl: RecentCrawl }) {
  const router = useRouter();
  const { t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issuesHref = `/crawl/issues?websiteId=${encodeURIComponent(crawl.websiteId)}&crawlId=${encodeURIComponent(crawl.id)}`;
  const compareHref = `${issuesHref}&compare=previous`;

  async function rerunCrawl() {
    setState("rerunning");
    setMessage(t("crawl.rerunStarted"));
    setError(null);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: crawl.websiteId,
          url: crawl.startUrl || crawl.websiteUrl,
        }),
      });
      const payload = (await response.json()) as {
        data?: { crawlId: string };
        error?: string;
      };

      if (!response.ok || !payload.data?.crawlId) {
        throw new Error(payload.error ?? t("crawl.notStarted"));
      }

      await waitForCrawl(payload.data.crawlId);
      setMessage(t("crawl.rerunFinished"));
      router.refresh();
    } catch (rerunError) {
      setError(rerunError instanceof Error ? rerunError.message : t("crawl.notStarted"));
    } finally {
      setState("idle");
    }
  }

  async function deleteCrawl() {
    setState("deleting");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/crawl/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: crawl.websiteId,
          crawlId: crawl.id,
          mode: "delete_single",
        }),
      });
      const payload = (await response.json()) as {
        data?: { deletedCrawls: number };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? t("crawl.delete"));
      }

      setMessage(t("crawl.deleted"));
      setConfirmDelete(false);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("crawl.delete"));
    } finally {
      setState("idle");
    }
  }

  function comparePrevious() {
    if (!crawl.hasPrevious) {
      setMessage(null);
      setError(t("crawl.noPrevious"));
      return;
    }

    router.push(compareHref);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("crawl.actions")}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-56 rounded-xl border bg-card p-1 shadow-xl shadow-black/30"
          >
            <DropdownMenu.Item asChild>
              <Link
                href={issuesHref}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-secondary"
              >
                <AlertTriangle className="size-4 text-warning" />
                {t("crawl.viewIssues")}
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-secondary"
              onSelect={(event) => {
                event.preventDefault();
                comparePrevious();
              }}
            >
              <GitCompare className="size-4 text-primary" />
              {t("crawl.comparePrevious")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-secondary"
              onSelect={(event) => {
                event.preventDefault();
                void rerunCrawl();
              }}
            >
              <RefreshCw className="size-4 text-success" />
              {t("crawl.rerun")}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmDelete(true);
              }}
            >
              <Trash2 className="size-4" />
              {t("crawl.delete")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {state === "rerunning" ? (
        <span className="flex items-center gap-1 text-xs text-primary">
          <Loader2 className="size-3 animate-spin" />
          {t("crawl.rerunning")}
        </span>
      ) : null}
      {message ? <span className="max-w-56 text-right text-xs text-success">{message}</span> : null}
      {error ? <span className="max-w-64 text-right text-xs text-destructive">{error}</span> : null}

      <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  {t("crawl.deleteTitle")}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("crawl.deleteDescription")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" disabled={state === "deleting"}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="mt-5 rounded-xl border bg-background/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <SearchCode className="size-4 text-primary" />
                {crawl.websiteName}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {crawl.startUrl || crawl.websiteUrl}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={state === "deleting"}>
                  {t("crawl.cancel")}
                </Button>
              </Dialog.Close>
              <Button variant="destructive" onClick={deleteCrawl} disabled={state === "deleting"}>
                {state === "deleting" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {t("crawl.delete")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
