import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional next action — usually a Link or Button. */
  action?: ReactNode;
  className?: string;
}

/** Quiet empty surface with an optional CTA. Prefer this over bare muted paragraphs. */
export function EmptyState({
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-2 rounded-lg bg-muted px-4 py-10 text-center sm:px-6 sm:py-12 ${className}`}
    >
      <p className="text-sm font-semibold text-text text-balance">{title}</p>
      {description ? (
        <p className="max-w-md text-pretty text-sm text-text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
