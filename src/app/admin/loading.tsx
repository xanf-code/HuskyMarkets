import { Skeleton } from "@/components/ui/Skeleton";

// Nested inside AdminLayout (which supplies the chrome and nav); mirrors the
// admin overview's 3-up card grid.
export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {["a", "b", "c"].map((k) => (
        <div key={k} className="card-surface p-5">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
