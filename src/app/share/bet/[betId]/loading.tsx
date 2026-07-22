import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors share bet card: callout, title, stake→payout, footer actions.
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center">
      <Skeleton className="h-6 w-48 sm:h-7" />
      <Skeleton className="mt-3 h-8 w-full sm:h-10" />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-28 sm:h-12" />
        <Skeleton className="h-6 w-8" />
        <Skeleton className="h-10 w-28 sm:h-12" />
      </div>
      <Skeleton className="mt-4 h-4 w-64 max-w-full" />
      <div className="mt-10 flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center">
        <Skeleton className="h-11 w-40 rounded-md" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
