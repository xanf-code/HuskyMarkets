import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors ModPage: pending / resolve / report queues as divided card lists.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 py-8 sm:py-12">
      <div>
        <Skeleton className="h-9 w-64 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      {["pending", "resolve", "reports"].map((section) => (
        <section key={section}>
          <Skeleton className="mb-4 h-4 w-32" />
          <ul className="card-surface divide-y divide-hairline overflow-hidden">
            {["a", "b", "c"].map((row) => (
              <li key={row} className="bg-card p-4 sm:p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-40" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-9 w-20 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
