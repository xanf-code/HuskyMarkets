import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { HcAmount } from "@/components/ui/HcAmount";
import type { HallOfFameEntry } from "@/lib/queries/leaderboard";

export function HallOfFame({ entries }: { entries: HallOfFameEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No past semester winners yet"
        description="Rankings lock in when a semester ends."
        action={
          <Link
            href="/"
            className="text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-red"
          >
            Browse markets
          </Link>
        }
      />
    );
  }

  const bySemester = new Map<string, HallOfFameEntry[]>();
  for (const e of entries) {
    const list = bySemester.get(e.semesterId) ?? [];
    list.push(e);
    bySemester.set(e.semesterId, list);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...bySemester.entries()].map(([id, rows]) => (
        <section key={id}>
          <h2 className="text-xl font-semibold text-text">
            {rows[0].semesterName}
          </h2>
          <ol className="card-surface mt-3 divide-y divide-hairline overflow-hidden">
            {rows.map((e) => (
              <li
                key={`${e.semesterId}-${e.rank}`}
                className="flex items-baseline gap-4 bg-card px-4 py-3 sm:px-5"
              >
                <span className="num w-10 shrink-0 text-2xl font-semibold text-red tabular-nums">
                  {e.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm sm:text-base text-text">
                  {e.displayName}
                </span>
                <span className="shrink-0 text-sm font-semibold text-text">
                  <HcAmount amount={e.score} size={14} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
