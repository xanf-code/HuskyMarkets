import {
  MarketCardSkeleton,
  MoverCardSkeleton,
  Skeleton,
} from "@/components/ui/Skeleton";

// Mirrors default home: Top movers (strip + lg rail) beside HomeShowcase
// category sections with hideCategory market cards.
export default function Loading() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className="flex flex-col gap-8 sm:gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="lg:hidden">
          <section className="flex flex-col gap-2 sm:gap-3" aria-hidden>
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
              {["a", "b", "c", "d"].map((k) => (
                <MoverCardSkeleton key={k} />
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-8 sm:gap-10">
          {["Campus", "Sports", "Events"].map((label) => (
            <section key={label} className="flex flex-col gap-3" aria-hidden>
              <Skeleton className="h-7 w-28" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {["1", "2", "3", "4"].map((k) => (
                  <MarketCardSkeleton key={k} hideCategory />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block" aria-hidden>
          <section className="flex flex-col gap-2 sm:gap-3">
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-col gap-2">
              {["a", "b", "c", "d"].map((k) => (
                <MoverCardSkeleton key={k} layout="rail" />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
