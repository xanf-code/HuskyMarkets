import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, id, className = "", ...rest }, ref) {
    const field = (
      <input
        ref={ref}
        id={id}
        className={`w-full border border-hairline bg-transparent px-4 py-3 text-base text-text placeholder:text-text-muted/60 transition-colors duration-200 ease-standard focus:border-red focus:outline-none sm:px-5 sm:py-4 ${className}`}
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
      </label>
    );
  },
);
