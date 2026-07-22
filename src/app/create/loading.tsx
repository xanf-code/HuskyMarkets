import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors CreateMarketForm: content-rule aside + stacked fields (no wrapping card).
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-52 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      <div className="flex flex-col gap-6">
        <div className="card-surface bg-red/5 px-4 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-12 w-full" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-11 w-full" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-full" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-24 w-full" />
        </div>

        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  );
}
