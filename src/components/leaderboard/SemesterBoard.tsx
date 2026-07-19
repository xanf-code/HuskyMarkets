import { formatHC } from "@/lib/format";
import type { SemesterEntry } from "@/lib/queries/leaderboard";

interface SemesterBoardProps {
  entries: SemesterEntry[];
  currentUserId?: string;
}

export function SemesterBoard({ entries, currentUserId }: SemesterBoardProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        No eligible traders this semester yet.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        Bailout claimers are hidden for the current ET week and reappear next
        Monday.
      </p>
      <ol className="card-surface divide-y divide-hairline overflow-hidden">
        {entries.map((e) => {
          const mine = e.userId === currentUserId;
          return (
            <li
              key={e.userId}
              className={`flex items-baseline gap-4 px-4 py-3 sm:px-5 ${
                mine ? "bg-muted" : "bg-card"
              }`}
            >
              <span className="num w-10 shrink-0 text-2xl font-semibold text-red">
                {e.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm sm:text-base ${
                  mine ? "font-bold text-text" : "text-text"
                }`}
              >
                {e.displayName}
                {mine ? " (you)" : ""}
              </span>
              <span className="num shrink-0 text-sm font-semibold text-text">
                {formatHC(e.score)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
