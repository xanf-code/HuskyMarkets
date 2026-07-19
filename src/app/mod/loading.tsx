import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors ModPage: max-w-3xl heading over resolve and report queue sections.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      {["resolve", "reports"].map((k) => (
        <section key={k}>
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="flex flex-col gap-3">
            {["a", "b", "c"].map((row) => (
              <Skeleton key={row} className="h-16 w-full" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
