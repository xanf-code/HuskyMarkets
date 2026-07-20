import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { formatHC } from "@/lib/format";
import type { ResolvedPosition } from "@/lib/queries/portfolio";

export function ResolvedHistory({ rows }: { rows: ResolvedPosition[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        No resolved bets yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.marketId} className="card-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${r.marketId}`}
                className="text-base font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {r.marketTitle}
              </Link>
              <p className="mt-1 text-sm text-text-muted">
                Outcome {r.outcomeLabel} ·{" "}
                {r.outcomeLabel === "Void"
                  ? "refunded"
                  : r.won
                    ? "you won"
                    : "you lost"}
              </p>
            </div>
            <p
              className={`num text-lg font-semibold ${
                r.won ? "text-market-yes" : "text-text-muted"
              }`}
            >
              {r.pnl > 0 ? "+" : ""}
              {formatHC(r.pnl)}
            </p>
          </div>
          <p className="num mt-3 text-sm text-text-muted">
            {formatHC(r.stake)} to {formatHC(r.payout)}
            {r.estimatedPayout != null
              ? ` · Est. payout ${formatHC(r.estimatedPayout)}`
              : ""}
          </p>
          {r.won && r.shareBetId ? (
            <Link
              href={`/share/bet/${r.shareBetId}`}
              className={`mt-3 ${buttonStyles({ variant: "secondary", size: "sm" })}`}
            >
              Share
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
