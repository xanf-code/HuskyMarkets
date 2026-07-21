import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { HcAmount } from "@/components/ui/HcAmount";
import { ShareActions } from "@/components/share/ShareActions";
import type { ResolvedPosition } from "@/lib/queries/portfolio";

export function ResolvedHistory({ rows }: { rows: ResolvedPosition[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No settled bets yet"
        description="When a market resolves, wins land here — and winners get a share card for the board."
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

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.marketId} className="card-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${r.marketId}`}
                className="line-clamp-2 text-base font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {r.marketTitle}
              </Link>
              <p className="mt-1 text-sm text-text-muted">
                <span className="break-words">Outcome {r.outcomeLabel}</span>
                {" · "}
                {r.outcomeLabel === "Void"
                  ? "refunded"
                  : r.won
                    ? "you won"
                    : "you lost"}
              </p>
            </div>
            <p
              className={`flex shrink-0 items-center gap-0.5 text-lg font-semibold ${
                r.won ? "text-market-yes" : "text-text-muted"
              }`}
            >
              {r.pnl > 0 ? <span aria-hidden="true">+</span> : null}
              <HcAmount amount={r.pnl} size={16} />
            </p>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-1 text-sm text-text-muted">
            <HcAmount amount={r.stake} size={12} />
            <span>to</span>
            <HcAmount amount={r.payout} size={12} />
            {r.estimatedPayout != null ? (
              <span className="inline-flex items-center gap-1">
                <span>· Est. payout</span>
                <HcAmount amount={r.estimatedPayout} size={12} />
              </span>
            ) : null}
          </p>
          {r.won && r.shareBetId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ShareActions
                path={`/share/bet/${r.shareBetId}`}
                title={`Called it — ${r.marketTitle}`}
              />
              <Link
                href={`/share/bet/${r.shareBetId}`}
                className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
              >
                View card
              </Link>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
