import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors ProfilePage: identity grid, career stats, appearance + notifications.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 sm:py-16">
      <div>
        <Skeleton className="h-9 w-52 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>

      <div className="card-surface grid grid-cols-1 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-hairline">
        {["balance", "mode", "handle"].map((k, i) => (
          <div
            key={k}
            className={`p-4 sm:p-5 ${i < 2 ? "border-b border-hairline sm:border-b-0" : ""}`}
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>

      <section>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="card-surface grid grid-cols-1 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-hairline">
          {["win", "loss", "streak"].map((k, i) => (
            <div
              key={k}
              className={`p-4 sm:p-5 ${i < 2 ? "border-b border-hairline sm:border-b-0" : ""}`}
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-8 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-4 sm:p-6">
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-20 rounded-md" />
          <Skeleton className="h-11 w-20 rounded-md" />
        </div>
      </section>

      <section className="card-surface p-4 sm:p-6">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-7 w-12 rounded-pill" />
        </div>
      </section>
    </div>
  );
}
