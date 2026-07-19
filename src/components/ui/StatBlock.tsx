interface StatBlockProps {
  label: string;
  value: string | number;
}

/** Big serif red numeral + bold label — design-system "by the numbers" voice. */
export function StatBlock({ label, value }: StatBlockProps) {
  return (
    <div className="bg-page p-4 sm:p-5">
      <p className="font-serif text-3xl text-red-bright sm:text-4xl">{value}</p>
      <p className="mt-2 text-sm font-bold text-text">{label}</p>
    </div>
  );
}
