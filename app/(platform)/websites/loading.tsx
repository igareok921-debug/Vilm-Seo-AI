import { LoadingState } from "@/components/loading-state";

export default function WebsitesLoading() {
  return (
    <div className="space-y-7">
      <div className="h-24 animate-pulse rounded-xl bg-secondary" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      <LoadingState rows={4} />
    </div>
  );
}
