import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-3 font-semibold leading-none border transition-colors duration-200 ease-standard disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "bg-red text-text border-transparent hover:bg-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red",
  secondary:
    "bg-transparent text-text border-hairline hover:border-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red",
  ghost:
    "bg-transparent text-red-bright border-transparent px-0 hover:text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2.5 text-sm",
  md: "px-7 py-4 text-base",
  lg: "px-9 py-5 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      withArrow = false,
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
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...rest}
      >
        <span>{children}</span>
        {withArrow ? <span aria-hidden="true">&rarr;</span> : null}
      </button>
    );
  },
);
