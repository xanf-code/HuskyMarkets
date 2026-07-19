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
