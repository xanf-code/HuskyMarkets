import type { ReactNode } from "react";

interface StatBlockProps {
  label: string;
  value: ReactNode;
}

/** Large tabular numeral + label — used in inverse “by the numbers” bands. */
export function StatBlock({ label, value }: StatBlockProps) {
  return (
    <div className="bg-card p-4 sm:p-5">
      <p className="num text-3xl font-semibold text-red sm:text-4xl">{value}</p>
      <p className="mt-2 text-sm font-semibold text-text">{label}</p>
    </div>
  );
}
