import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors OnboardingPage: max-w-md heading over the identity-choice form.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="card-surface flex flex-col gap-5 p-4 sm:p-6">
        {["a", "b"].map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
