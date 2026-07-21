import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, id, className = "", error, ...rest }, ref) {
    const errorId = error ? `${id}-error` : undefined;
    const field = (
      <input
        ref={ref}
        id={id}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-md border ${error ? "border-red" : "border-hairline"} bg-card px-3.5 py-2.5 text-base text-text placeholder:text-text-tertiary transition-colors duration-200 ease-standard focus:border-red focus:outline-none sm:px-4 sm:py-3 ${className}`}
        {...rest}
      />
    );
    if (!label) return field;
    return (
      <label htmlFor={id} className="block">
        <span className="mb-2 block text-sm font-semibold text-text">
          {label}
        </span>
        {field}
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-xs text-market-no">
            {error}
          </p>
        ) : null}
      </label>
    );
  },
);
