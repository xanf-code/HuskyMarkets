import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors LeaderboardPage: inverse hero block, tab strip, ranked rows.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div className="rounded-lg bg-inverse px-6 py-8 sm:px-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <Skeleton className="h-[4.5rem] w-full rounded-lg" />
      <div className="flex gap-4 border-b border-hairline">
        {["semester", "accuracy", "fame"].map((k) => (
          <Skeleton key={k} className="h-9 w-28" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {["a", "b", "c", "d", "e", "f"].map((k) => (
          <Skeleton key={k} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
