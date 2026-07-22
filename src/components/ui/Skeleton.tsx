interface SkeletonProps {
  className?: string;
}

// Decorative loading placeholder. Uses existing tokens only (bg-muted); the
// caller passes sizing/shape via className to mirror the real element.
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div aria-hidden className={`animate-pulse rounded-md bg-muted ${className}`} />
  );
}

/** Mirrors MarketCard — category chip optional when a parent section labels it. */
export function MarketCardSkeleton({
  hideCategory = false,
}: {
  hideCategory?: boolean;
}) {
  return (
    <div className="card-surface flex flex-col gap-2 p-4">
      {hideCategory ? (
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-6 w-20 rounded-pill" />
          <Skeleton className="h-4 w-14" />
        </div>
      )}
      {!hideCategory ? <Skeleton className="h-5 w-full" /> : null}
      <div className="flex items-center gap-3">
        <Skeleton className="h-2 min-w-0 flex-1 rounded-pill" />
        <Skeleton className="h-4 w-10 shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-hairline pt-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

/** Mirrors HomeSidebar mover tiles (strip carousel or sticky rail). */
export function MoverCardSkeleton({
  layout = "strip",
}: {
  layout?: "strip" | "rail";
}) {
  return (
    <div
      className={`card-surface flex items-center ${
        layout === "rail"
          ? "w-full gap-4 px-5 py-4"
          : "w-[78%] shrink-0 gap-3 px-4 py-3 sm:w-auto sm:shrink"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  );
}

/** Mirrors Tabs underline strip (gap-6, min-h-11). */
export function TabStripSkeleton({
  count,
  widths = [],
}: {
  count: number;
  widths?: string[];
}) {
  return (
    <div className="flex gap-6 border-b border-hairline">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-11 ${widths[i] ?? "w-20"} rounded-none`}
        />
      ))}
    </div>
  );
}
