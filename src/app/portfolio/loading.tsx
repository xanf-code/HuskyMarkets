import { Skeleton, TabStripSkeleton } from "@/components/ui/Skeleton";

// Mirrors PortfolioPage: heading, 5-tab strip, open-position card rows.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-40 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-6">
        <TabStripSkeleton
          count={5}
          widths={["w-12", "w-20", "w-16", "w-16", "w-14"]}
        />
        <ul className="flex flex-col gap-3">
          {["a", "b", "c", "d"].map((k) => (
            <li key={k} className="card-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {["s", "p", "v"].map((stat) => (
                  <div key={stat}>
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="mt-1 h-4 w-16" />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
