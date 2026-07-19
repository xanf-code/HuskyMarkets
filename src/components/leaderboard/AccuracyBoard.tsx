import { formatHC } from "@/lib/format";
import type { AccuracyEntry } from "@/lib/queries/leaderboard";

interface AccuracyBoardProps {
  entries: AccuracyEntry[];
  currentUserId?: string;
}

export function AccuracyBoard({ entries, currentUserId }: AccuracyBoardProps) {
  if (entries.length === 0) {
    return (
      <p className="num text-sm text-text-muted">
        &gt; need ≥10 resolved bets to appear_
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        Ranked by win rate on markets resolved this semester. Minimum 10
        resolved bets.
      </p>
      <ol className="flex flex-col gap-px border border-hairline bg-hairline">
        {entries.map((e) => {
          const mine = e.userId === currentUserId;
          return (
            <li
              key={e.userId}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 sm:px-5 ${
                mine ? "bg-ink" : "bg-page"
              }`}
            >
              <span className="font-serif text-2xl text-red-bright tabular-nums w-10 shrink-0">
                {e.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm sm:text-base ${
                  mine ? "font-bold text-text" : "text-text"
                }`}
              >
                {e.displayName}
              </span>
              <span className="num text-sm text-text">
                {(e.winRate * 100).toFixed(1)}% · {e.wins}W/{e.losses}L ·{" "}
                {formatHC(e.volume)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
