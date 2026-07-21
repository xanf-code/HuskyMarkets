import Link from "next/link";
import { formatPercent } from "@/lib/format";
import { leadingOutcome } from "@/lib/outcomes";
import type { MarketListItem } from "@/lib/queries/markets";

const BANNER_SIZE = 4;

interface MoverRow {
  market: MarketListItem;
  delta: number;
}

export function getTopMovers(markets: readonly MarketListItem[]): MoverRow[] {
  return markets
    .map((market) => {
      const spark = market.spark;
      if (spark.length < 2) return { market, delta: 0 };
      return { market, delta: spark[spark.length - 1] - spark[0] };
    })
    .filter((row) => row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, BANNER_SIZE);
}

/**
 * Top-movers banner strip: sits below search/filters, above the main feed.
 * Derived from the already-fetched market list — no extra queries. Only
 * rendered on category pages.
 */
export function HomeSidebar({ markets }: { markets: MarketListItem[] }) {
  const moverRows = getTopMovers(markets);

  if (moverRows.length === 0) return null;

  return (
    <section aria-label="Top movers" className="flex flex-col gap-2 sm:gap-3">
      <h2 className="eyebrow text-text-muted">Top movers</h2>
      {/* Mobile: horizontal snap-scroll carousel so the feed below stays
          within reach — a stacked grid here pushed users too far down.
          sm+: reverts to a static grid, plenty of width to spare. */}
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {moverRows.map((row) => (
          <MoverCard key={row.market.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function MoverCard({ row }: { row: MoverRow }) {
  const { market, delta } = row;
  const leader = leadingOutcome(market.outcomes);
  const up = delta > 0;
  return (
    <Link
      href={`/market/${market.id}`}
      className="card-surface flex w-[78%] shrink-0 snap-start items-center gap-3 px-4 py-3 transition-[box-shadow,border-color,background-color] duration-200 ease-standard hover:border-border-strong hover:bg-muted hover:shadow-card-hover focus-visible:outline-red sm:w-auto sm:shrink"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium text-text">
          {market.title}
        </span>
        {leader ? (
          <span className="truncate text-xs text-text-muted">
            {leader.label}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {leader ? (
          <span className="num text-sm font-semibold text-text">
            {formatPercent(leader.implied)}
          </span>
        ) : null}
        <span
          className={`num inline-flex items-center gap-0.5 text-xs font-semibold ${
            up ? "text-market-yes" : "text-market-no"
          }`}
          aria-label={`${up ? "up" : "down"} ${Math.abs(delta).toFixed(1)} points`}
        >
          {up ? (
            <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M4 1L7 6H1L4 1Z"/></svg>
          ) : (
            <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M4 7L1 2H7L4 7Z"/></svg>
          )}
          {Math.abs(delta).toFixed(1)}
        </span>
      </div>
    </Link>
  );
}
