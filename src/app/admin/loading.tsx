import { Skeleton } from "@/components/ui/Skeleton";

// Nested inside AdminLayout; mirrors the overview's 4-up queue cards.
export default function Loading() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {["a", "b", "c", "d"].map((k) => (
        <li key={k} className="card-surface p-5">
          <Skeleton className="h-9 w-12" />
          <Skeleton className="mt-2 h-4 w-28" />
        </li>
      ))}
    </ul>
  );
}
