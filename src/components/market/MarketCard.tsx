import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { HcAmount } from "@/components/ui/HcAmount";
import { CATEGORIES } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { leadingOutcome, totalPool } from "@/lib/outcomes";
import type { MarketListItem } from "@/lib/queries/markets";
import { outcomeColor } from "@/lib/theme";
import { Countdown } from "./Countdown";

export function MarketCard({ market }: { market: MarketListItem }) {
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;
  const leader = leadingOutcome(market.outcomes);
  // Top-2 outcomes by pool, ties broken by sort_order; the rest collapse
  // into a "+N more" badge (FR-25). Driven entirely by the outcomes array.
  const top = [...market.outcomes]
    .sort((a, b) => b.pool - a.pool || a.sortOrder - b.sortOrder)
    .slice(0, 2);
  const more = market.outcomes.length - top.length;
  const pool = totalPool(market.outcomes);
  const stats = [
    { label: "Volume", value: <HcAmount amount={market.volume} size={12} /> },
    {
      label: "Predictors",
      value:
        market.bettorCount === null ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-label="Locked"
            className="inline-block h-3.5 w-3.5 opacity-40"
          >
            <path
              fillRule="evenodd"
              d="M8 1a3 3 0 0 0-3 3v1H3.5A1.5 1.5 0 0 0 2 6.5v7A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 5H11V4a3 3 0 0 0-3-3Zm-1.5 4V4a1.5 1.5 0 0 1 3 0v1h-3Zm1.5 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          String(market.bettorCount)
        ),
    },
    { label: "Pool", value: <HcAmount amount={pool} size={12} /> },
  ];

  return (
    <article className="card-surface flex flex-col gap-3 p-4 transition-[box-shadow,border-color] duration-200 ease-standard hover:border-border-strong hover:shadow-card-hover sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Chip>{categoryLabel}</Chip>
        <Countdown closeAt={market.closeAt} />
      </div>

      <Link
        href={`/market/${market.id}`}
        className="focus-visible:outline-red"
      >
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-text sm:text-base">
          {market.title}
        </h3>
      </Link>

      {leader ? (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`${leader.label} probability`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={leader.implied}
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-muted"
          >
            <div
              className="h-full rounded-pill transition-[width] duration-200 ease-standard"
              style={{ width: `${leader.implied}%`, backgroundColor: outcomeColor(leader.sortOrder) }}
            />
          </div>
          <span className="num shrink-0 text-sm font-semibold text-text">
            {formatPercent(leader.implied)}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {top.map((outcome) => (
          <Link
            key={outcome.id}
            href={`/market/${market.id}`}
            aria-label={`${outcome.label} ${formatPercent(outcome.implied)}`}
            className="flex items-center justify-between rounded-md border border-hairline bg-muted px-3 py-2.5 text-sm font-semibold text-text transition-transform duration-200 ease-standard hover:scale-[0.98] hover:border-border-strong focus-visible:outline-red"
          >
            <span className="truncate">{outcome.label}</span>
            <span className="num text-text-muted">{formatPercent(outcome.implied)}</span>
          </Link>
        ))}
        {more > 0 ? (
          <span className="col-span-2 text-center text-xs font-medium text-text-muted">
            +{more} more
          </span>
        ) : null}
      </div>

      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-hairline pt-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 text-center first:text-left last:text-right">
            <dt className="text-[10px] font-medium tracking-wide text-text-muted uppercase">
              {stat.label}
            </dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-text">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
