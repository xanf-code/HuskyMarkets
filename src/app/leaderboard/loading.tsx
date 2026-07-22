import { Skeleton, TabStripSkeleton } from "@/components/ui/Skeleton";

// Mirrors LeaderboardPage: plain hero, prize card, tabs, divided board list.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-48 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>

      <aside className="card-surface flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
        <Skeleton className="h-9 w-14 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
      </aside>

      <div className="flex flex-col gap-6">
        <TabStripSkeleton count={3} widths={["w-20", "w-20", "w-28"]} />
        <ol className="card-surface divide-y divide-hairline overflow-hidden">
          {["a", "b", "c", "d", "e", "f"].map((k) => (
            <li
              key={k}
              className="flex items-baseline gap-3 px-3 py-3 sm:gap-4 sm:px-5"
            >
              <Skeleton className="h-7 w-8 shrink-0 sm:h-8 sm:w-10" />
              <Skeleton className="h-4 min-w-0 flex-1" />
              <Skeleton className="h-4 w-16 shrink-0" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
