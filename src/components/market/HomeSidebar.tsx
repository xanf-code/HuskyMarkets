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
    .filter((market) => market.change24h !== null && market.change24h !== 0)
    .map((market) => ({ market, delta: market.change24h! }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, BANNER_SIZE);
}

/**
 * Top movers — strip (carousel/grid) or rail (vertical stack for lg sidebar).
 * Derived from the already-fetched market list — no extra queries.
 */
export function HomeSidebar({
  markets,
  layout = "strip",
}: {
  markets: MarketListItem[];
  layout?: "strip" | "rail";
}) {
  const moverRows = getTopMovers(markets);

  if (moverRows.length === 0) return null;

  const listClass =
    layout === "rail"
      ? "flex flex-col gap-2"
      : "no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4";

  return (
    <section aria-label="Top movers" className="flex flex-col gap-2 sm:gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-text">Top movers</h2>
        <p className="text-xs text-text-muted">Last 24 hours</p>
      </div>
      <div className={listClass}>
        {moverRows.map((row) => (
          <MoverCard key={row.market.id} row={row} layout={layout} />
        ))}
      </div>
    </section>
  );
}

function MoverCard({
  row,
  layout,
}: {
  row: MoverRow;
  layout: "strip" | "rail";
}) {
  const { market, delta } = row;
  const leader = leadingOutcome(market.outcomes);
  const up = delta > 0;
  return (
    <Link
      href={`/market/${market.id}`}
      className={`card-surface flex items-center gap-3 px-4 py-3 transition-[box-shadow,border-color,background-color] duration-200 ease-standard hover:border-border-strong hover:bg-muted hover:shadow-card-hover focus-visible:outline-red ${
        layout === "rail"
          ? "w-full"
          : "w-[78%] shrink-0 snap-start sm:w-auto sm:shrink"
      }`}
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
