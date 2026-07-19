import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors ProfilePage: max-w-2xl heading, a 3-up stat grid, two section cards.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 sm:py-16">
      <div>
        <Skeleton className="h-9 w-52" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="card-surface grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3">
        {["balance", "mode", "handle"].map((k) => (
          <div key={k} className="p-4 sm:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>
      {["stats", "moderation"].map((k) => (
        <div key={k} className="card-surface p-4 sm:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
