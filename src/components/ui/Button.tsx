import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export interface ButtonStyleOptions {
  variant?: Variant;
  size?: Size;
}

/** Compose the design-system button classes for non-button elements (e.g. links). */
export function buttonStyles({
  variant = "primary",
  size = "md",
}: ButtonStyleOptions = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold leading-none rounded-md border transition-[colors,transform] duration-200 ease-standard active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "bg-red text-white border-transparent hover:bg-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red",
  secondary:
    "bg-card text-text border-border-strong hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red",
  ghost:
    "bg-transparent text-red border-transparent px-0 hover:text-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`${buttonStyles({ variant, size })} ${className}`}
        {...rest}
      >
        <span>{children}</span>
      </button>
    );
  },
);
