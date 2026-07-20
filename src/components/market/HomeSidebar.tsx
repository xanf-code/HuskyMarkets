import Link from "next/link";
import { formatPercent } from "@/lib/format";
import { leadingOutcome } from "@/lib/outcomes";
import type { MarketListItem } from "@/lib/queries/markets";
import { outcomeColor } from "@/lib/theme";

const PANEL_SIZE = 5;

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
    .slice(0, PANEL_SIZE);
}

/**
 * Right-rail panel: Top Movers. Derived from the already-fetched market list
 * — no extra queries. Only rendered on category pages.
 */
export function HomeSidebar({ markets }: { markets: MarketListItem[] }) {
  const moverRows = getTopMovers(markets);

  return (
    <aside
      aria-label="Market highlights"
      className="flex flex-col gap-4 sm:gap-5"
    >
      {moverRows.length > 0 ? (
        <Panel title="Top movers">
          {moverRows.map((row) => (
            <MoverRow key={row.market.id} row={row} />
          ))}
        </Panel>
      ) : null}
    </aside>
  );
}

interface PanelProps {
  title: string;
  children: React.ReactNode;
}

function Panel({ title, children }: PanelProps) {
  return (
    <section className="card-surface overflow-hidden">
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
      </header>
      <ul className="divide-y divide-hairline">{children}</ul>
    </section>
  );
}

function MoverRow({ row }: { row: MoverRow }) {
  const { market, delta } = row;
  const leader = leadingOutcome(market.outcomes);
  const up = delta > 0;
  return (
    <li>
      <Link
        href={`/market/${market.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 ease-standard hover:bg-muted focus-visible:outline-red"
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
            <span aria-hidden="true">{up ? "▲" : "▼"}</span>
            {Math.abs(delta).toFixed(1)}
          </span>
        </div>
      </Link>
    </li>
  );
}
