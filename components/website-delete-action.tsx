"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

const ACTIVE_WEBSITE_STORAGE_KEY = "vilm-active-website-id";

interface WebsiteDeleteActionLabels {
  delete: string;
  deleteTooltip: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteCancel: string;
  deleteConfirm: string;
  deleteSuccess: string;
  deleteFailed: string;
}

export function WebsiteDeleteAction({
  websiteId,
  websiteName,
  labels,
}: {
  websiteId: string;
  websiteName: string;
  labels: WebsiteDeleteActionLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    setMessage("");
    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/websites?websiteId=${encodeURIComponent(websiteId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        data?: { deleted?: boolean };
        error?: string;
      };

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error || labels.deleteFailed);
      }

      if (window.localStorage.getItem(ACTIVE_WEBSITE_STORAGE_KEY) === websiteId) {
        window.localStorage.removeItem(ACTIVE_WEBSITE_STORAGE_KEY);
      }

      setMessage(labels.deleteSuccess);
      startTransition(() => {
        router.refresh();
      });
      setOpen(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : labels.deleteFailed);
    } finally {
      setIsDeleting(false);
    }
  }

  const disabled = isDeleting || isPending;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setMessage("");
          setError("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-lg px-2.5 transition hover:bg-destructive/10 hover:text-destructive"
          title={labels.deleteTooltip}
        >
          <Trash2 className="size-4" />
          {labels.delete}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">{labels.deleteTitle}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {labels.deleteDescription}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 rounded-xl border bg-secondary/40 p-4 text-sm font-medium">
            {websiteName}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
              {message}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={disabled}>
                {labels.deleteCancel}
              </Button>
            </Dialog.Close>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={disabled}>
              {disabled ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {labels.deleteConfirm}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
