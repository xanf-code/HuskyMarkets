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
      className={`eyebrow inline-flex items-center border px-2.5 py-1 ${
        active
          ? "border-red text-red-bright"
          : "border-hairline text-text-muted"
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
