"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type CleanupMode = "keep_latest" | "older_than_7_days" | "delete_all";

const options: Array<{
  mode: CleanupMode;
  title: string;
  description: string;
}> = [
  {
    mode: "keep_latest",
    title: "Keep only the latest crawl",
    description: "Delete older completed crawls and keep the latest completed crawl.",
  },
  {
    mode: "older_than_7_days",
    title: "Delete crawls older than 7 days",
    description: "Clean old history without touching recent crawls.",
  },
  {
    mode: "delete_all",
    title: "Delete all crawls for the selected website",
    description: "Delete history, audits, issues, and crawled pages for the current website.",
  },
];

export function CrawlHistoryCleanup({
  websiteId,
  disabled,
}: {
  websiteId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<CleanupMode>("keep_latest");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function cleanup() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/crawl/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            websiteId,
            mode: selectedMode,
          }),
        });

        const payload = (await response.json()) as {
          data?: { deletedCrawls: number };
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "History cleanup failed.");
        }

        setMessage(`${payload.data.deletedCrawls} crawls were deleted.`);
        router.refresh();
      } catch (cleanupError) {
        setError(
          cleanupError instanceof Error
            ? cleanupError.message
            : "History cleanup failed.",
        );
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Trash2 className="size-4" />
          Delete old crawls
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                Delete old crawls
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                This operation applies strictly to the selected website. Other websites are not affected.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" disabled={isPending}>
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-3">
            {options.map((option) => (
              <label
                key={option.mode}
                className="flex cursor-pointer gap-3 rounded-xl border bg-background/40 p-4 transition hover:bg-secondary/50"
              >
                <input
                  type="radio"
                  name="cleanup-mode"
                  value={option.mode}
                  checked={selectedMode === option.mode}
                  onChange={() => setSelectedMode(option.mode)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={isPending}>Cancel</Button>
            </Dialog.Close>
            <Button variant="destructive" onClick={cleanup} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Confirm deletion
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
