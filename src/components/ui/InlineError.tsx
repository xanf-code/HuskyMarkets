export interface InlineErrorProps {
  children: string;
  id?: string;
  className?: string;
}

/** Consistent field/form error with a live region for screen readers. */
export function InlineError({
  children,
  id,
  className = "",
}: InlineErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className={`text-sm text-market-no text-pretty break-words ${className}`}
    >
      {children}
    </p>
  );
}
