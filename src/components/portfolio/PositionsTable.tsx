import Link from "next/link";
import { Countdown } from "@/components/market/Countdown";
import { formatCents, formatHC } from "@/lib/format";
import type { OpenPosition } from "@/lib/queries/portfolio";

export function PositionsTable({ positions }: { positions: OpenPosition[] }) {
  if (positions.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        No open positions.
      </p>
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
                className="text-base font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {p.marketTitle}
              </Link>
              <p className="mt-1 text-sm font-semibold text-market-yes">
                {p.outcomeLabel}
              </p>
            </div>
            <Countdown closeAt={p.closeAt} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-text-muted">Stake</dt>
              <dd className="num mt-1">{formatHC(p.stake)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted">Avg price</dt>
              <dd className="num mt-1">{formatCents(p.avgPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted">
                Implied value
              </dt>
              <dd className="num mt-1 font-semibold text-text">
                {formatHC(p.impliedValue)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
