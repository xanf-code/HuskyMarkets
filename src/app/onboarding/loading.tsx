import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors OnboardingPage: how-it-works strip + display-mode options + theme + CTA.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 py-8 sm:py-16">
      <div>
        <Skeleton className="h-9 w-56 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      <ol className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:px-5">
        {["a", "b", "c"].map((k) => (
          <li key={k} className="flex gap-3">
            <Skeleton className="h-4 w-3 shrink-0" />
            <Skeleton className="h-10 min-w-0 flex-1" />
          </li>
        ))}
      </ol>

      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="mb-3 h-4 w-28" />
          {["anon", "real"].map((k) => (
            <div
              key={k}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-card p-4 sm:p-5"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>

        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  );
}
