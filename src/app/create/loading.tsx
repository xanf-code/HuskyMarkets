import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors CreatePage: max-w-xl heading over a form card of label/input pairs.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-44" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="card-surface flex flex-col gap-5 p-4 sm:p-6">
        {["a", "b", "c", "d"].map((k) => (
          <div key={k} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
