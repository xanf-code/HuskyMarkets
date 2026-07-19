import Link from "next/link";
import { formatHC } from "@/lib/format";
import type { ResolvedPosition } from "@/lib/queries/portfolio";

export function ResolvedHistory({ rows }: { rows: ResolvedPosition[] }) {
  if (rows.length === 0) {
    return (
      <p className="num text-sm text-text-muted">&gt; no resolved bets yet_</p>
    );
  }

  return (
    <ul className="flex flex-col gap-px border border-hairline bg-hairline">
      {rows.map((r) => (
        <li key={r.marketId} className="bg-page p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${r.marketId}`}
                className="font-serif text-lg text-text hover:text-red-bright focus-visible:outline-red"
              >
                {r.marketTitle}
              </Link>
              <p className="mt-1 text-sm text-text-muted">
                Outcome {r.outcome.toUpperCase()} · you {r.side.toUpperCase()}
              </p>
            </div>
            <p
              className={`num text-lg font-semibold ${
                r.won ? "text-red-bright" : "text-text"
              }`}
            >
              {r.pnl > 0 ? "+" : ""}
              {formatHC(r.pnl)}
            </p>
          </div>
          <p className="num mt-3 text-sm text-text-muted">
            {formatHC(r.stake)} → {formatHC(r.payout)}
          </p>
          {r.won ? (
            <Link
              href={`/share/${r.marketId}`}
              className="eyebrow mt-3 inline-block text-red-bright focus-visible:outline-red"
            >
              Share →
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
