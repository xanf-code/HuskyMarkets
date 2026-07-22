import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors LoginPage: heading + email form fields.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <Skeleton className="h-9 w-36 sm:h-10" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-11 w-48 rounded-md" />
      </div>
    </div>
  );
}