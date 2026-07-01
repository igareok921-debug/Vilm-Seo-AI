import { LoadingState } from "@/components/loading-state";

export default function PlatformLoading() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-xl bg-secondary" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-secondary" />)}
      </div>
      <LoadingState rows={5} />
    </div>
  );
}
