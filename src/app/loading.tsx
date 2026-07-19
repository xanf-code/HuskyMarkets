import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors the home grid: a filter pill row over a 6-card market grid
// (see MarketCard) so the layout does not shift when markets stream in.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap gap-2">
        {["a", "b", "c", "d", "e"].map((k) => (
          <Skeleton key={k} className="h-9 w-24 rounded-pill" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c", "d", "e", "f"].map((k) => (
          <div key={k} className="card-surface flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-20 rounded-pill" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-2 w-full rounded-pill" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
