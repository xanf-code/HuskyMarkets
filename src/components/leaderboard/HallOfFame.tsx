import { formatHC } from "@/lib/format";
import type { HallOfFameEntry } from "@/lib/queries/leaderboard";

export function HallOfFame({ entries }: { entries: HallOfFameEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="num text-sm text-text-muted">
        &gt; no frozen semesters yet_
      </p>
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
          <h2 className="font-serif text-xl text-text">
            {rows[0].semesterName}
          </h2>
          <ol className="mt-3 flex flex-col gap-px border border-hairline bg-hairline">
            {rows.map((e) => (
              <li
                key={`${e.semesterId}-${e.rank}`}
                className="flex items-baseline gap-4 bg-page px-4 py-3 sm:px-5"
              >
                <span className="font-serif text-2xl text-red-bright tabular-nums w-10 shrink-0">
                  {e.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm sm:text-base text-text">
                  {e.displayName}
                </span>
                <span className="num shrink-0 text-sm font-semibold">
                  {formatHC(e.score)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
