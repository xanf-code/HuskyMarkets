import Link from "next/link";
import { Countdown } from "@/components/market/Countdown";
import { formatCents, formatHC } from "@/lib/format";
import type { OpenPosition } from "@/lib/queries/portfolio";

export function PositionsTable({ positions }: { positions: OpenPosition[] }) {
  if (positions.length === 0) {
    return (
      <p className="num text-sm text-text-muted">
        &gt; no open positions_
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-px border border-hairline bg-hairline">
      {positions.map((p) => (
        <li key={`${p.marketId}:${p.side}`} className="bg-page p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${p.marketId}`}
                className="font-serif text-lg text-text hover:text-red-bright focus-visible:outline-red"
              >
                {p.marketTitle}
              </Link>
              <p className="mt-1 text-sm font-semibold uppercase text-text-muted">
                {p.side}
              </p>
            </div>
            <Countdown closeAt={p.closeAt} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="eyebrow text-text-muted">Stake</dt>
              <dd className="num mt-1">{formatHC(p.stake)}</dd>
            </div>
            <div>
              <dt className="eyebrow text-text-muted">Avg price</dt>
              <dd className="num mt-1">{formatCents(p.avgPrice)}</dd>
            </div>
            <div>
              <dt className="eyebrow text-text-muted">Implied value</dt>
              <dd className="num mt-1 text-red-bright">
                {formatHC(p.impliedValue)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
