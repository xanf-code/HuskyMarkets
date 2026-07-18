import { forwardRef, type SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  id: string;
  options: (string | SelectOption)[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, id, options, placeholder, className = "", ...rest }, ref) {
    const field = (
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={`w-full cursor-pointer appearance-none border border-hairline bg-transparent px-4 py-3 pr-12 text-base text-text transition-colors duration-200 ease-standard focus:border-red focus:outline-none sm:px-5 sm:py-4 [&>option]:bg-ink [&>option]:text-text ${className}`}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const optionLabel =
              typeof option === "string" ? option : option.label;
            return (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-red-bright"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
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
