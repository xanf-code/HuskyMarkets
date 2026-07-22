import Link from "next/link";
import { Countdown } from "@/components/market/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { HcAmount } from "@/components/ui/HcAmount";
import { formatPercent } from "@/lib/format";
import type { OpenPosition } from "@/lib/queries/portfolio";

export function PositionsTable({ positions }: { positions: OpenPosition[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        title="No open positions yet"
        description="Stake HuskyCoin on a campus take - one bet puts you on the semester leaderboard."
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
      {positions.map((p) => (
        <li
          key={`${p.marketId}:${p.outcomeId}`}
          className="card-surface p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${p.marketId}`}
                className="line-clamp-2 text-base font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {p.marketTitle}
              </Link>
              <p className="mt-1 truncate text-sm font-semibold text-text">
                {p.outcomeLabel}
              </p>
            </div>
            <Countdown closeAt={p.closeAt} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">Stake</dt>
              <dd className="mt-1 truncate">
                <HcAmount amount={p.stake} size={14} />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">Avg price</dt>
              <dd className="num mt-1">{formatPercent(p.avgPrice)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">
                Est. value
              </dt>
              <dd className="mt-1 truncate font-semibold text-text">
                <HcAmount amount={p.impliedValue} size={14} />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-text-tertiary">
            Waiting on resolution - a win unlocks a share card under Resolved.
          </p>
        </li>
      ))}
    </ul>
  );
}
