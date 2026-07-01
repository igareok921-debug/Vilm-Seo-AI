import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-3", className)}>
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
        <Sparkles className="size-[18px]" />
      </span>
      {!compact && (
        <span className="font-[var(--font-manrope)] text-[15px] font-extrabold tracking-tight">
          VILM <span className="text-primary">SEO AI</span>
        </span>
      )}
    </Link>
  );
}
