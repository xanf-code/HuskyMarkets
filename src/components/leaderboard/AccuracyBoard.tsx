import { formatHC } from "@/lib/format";
import type { AccuracyEntry } from "@/lib/queries/leaderboard";

interface AccuracyBoardProps {
  entries: AccuracyEntry[];
  currentUserId?: string;
}

export function AccuracyBoard({ entries, currentUserId }: AccuracyBoardProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        Need at least 10 resolved bets to appear on the accuracy board.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        Ranked by win rate on markets resolved this semester. Minimum 10
        resolved bets.
      </p>
      <ol className="card-surface divide-y divide-hairline overflow-hidden">
        {entries.map((e) => {
          const mine = e.userId === currentUserId;
          return (
            <li
              key={e.userId}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 sm:px-5 ${
                mine ? "bg-muted" : "bg-card"
              }`}
            >
              <span className="num w-10 shrink-0 text-2xl font-semibold text-red tabular-nums">
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
                <span className="text-market-yes">
                  {(e.winRate * 100).toFixed(1)}%
                </span>
                {" · "}
                <span className="text-market-yes">{e.wins}W</span>/
                <span className="text-market-no">{e.losses}L</span>
                {" · "}
                {formatHC(e.volume)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
