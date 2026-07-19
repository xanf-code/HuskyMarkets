import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors MarketPage: chip row, title, price + chart on the left; sticky order
// panel on the right; stats and activity rows below.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6">
      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-6 w-20 rounded-pill" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-3 h-9 w-3/4" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        </div>
        <div>
          <Skeleton className="h-16 w-40" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
      <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
        <Skeleton className="h-12 w-full" />
        <div className="card-surface overflow-hidden">
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex flex-col gap-3">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
