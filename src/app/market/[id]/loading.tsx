import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors MarketPage: header → sticky order panel → price/chart → stats/rules/activity.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6">
      <div className="order-1 flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-6 w-20 rounded-pill" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-3 h-8 w-4/5 sm:h-10" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        </div>
      </div>

      <div className="order-3 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-24">
        <div className="card-surface flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          {["a", "b"].map((k) => (
            <Skeleton key={k} className="h-11 w-full rounded-md" />
          ))}
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="flex gap-2">
            {["a", "b", "c"].map((k) => (
              <Skeleton key={k} className="h-11 w-14 rounded-pill" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>

      <div className="order-2 lg:col-start-1 lg:row-start-2">
        <div className="flex items-baseline gap-3">
          <Skeleton className="h-12 w-24 sm:h-14" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="card-surface mt-4 h-56 w-full sm:h-72" aria-hidden />
      </div>

      <div className="order-4 flex flex-col gap-6 lg:col-start-1 lg:row-start-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {["a", "b", "c"].map((k) => (
            <div key={k} className="card-surface px-4 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-20" />
            </div>
          ))}
        </div>

        <div className="card-surface overflow-hidden">
          <div className="border-b border-hairline bg-muted/50 px-4 py-3">
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="flex flex-col gap-3 px-4 py-4">
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {["a", "b", "c", "d"].map((k) => (
                <Skeleton key={k} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>

        <div>
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="card-surface divide-y divide-hairline overflow-hidden">
            {["a", "b", "c", "d"].map((k) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
