import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors PortfolioPage: max-w-3xl heading, tab strip, and stacked card rows.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="flex gap-4 border-b border-hairline">
        {["open", "resolved", "ledger"].map((k) => (
          <Skeleton key={k} className="h-9 w-24" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
