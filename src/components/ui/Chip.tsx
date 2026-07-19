import type { HTMLAttributes } from "react";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
}

export function Chip({
  active = false,
  className = "",
  children,
  ...rest
}: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-red/10 text-red"
          : "bg-muted text-text-muted"
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
