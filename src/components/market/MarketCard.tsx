import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { CATEGORIES } from "@/lib/constants";
import { formatCents, formatHC, formatPercent } from "@/lib/format";
import { leadingOutcome } from "@/lib/outcomes";
import type { MarketListItem } from "@/lib/queries/markets";
import { outcomeColor } from "@/lib/theme";
import { Countdown } from "./Countdown";
import { Sparkline } from "./Sparkline";

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
        <h3 className="text-[15px] font-semibold leading-snug text-text sm:text-base">
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
            aria-label={`${outcome.label} ${formatCents(outcome.implied)}`}
            className="flex items-center justify-between rounded-md border border-hairline bg-muted px-3 py-2.5 text-sm font-semibold text-text transition-transform duration-200 ease-standard hover:scale-[0.98] hover:border-border-strong focus-visible:outline-red"
          >
            <span className="truncate">{outcome.label}</span>
            <span className="num text-text-muted">{formatCents(outcome.implied)}</span>
          </Link>
        ))}
        {more > 0 ? (
          <span className="col-span-2 text-center text-xs font-medium text-text-muted">
            +{more} more
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3 pt-1">
        {market.volume > 0 && market.spark.length >= 2 ? (
          <Sparkline
            points={market.spark}
            label={leader?.label ?? "Leading outcome"}
            colorIndex={leader?.sortOrder ?? 0}
          />
        ) : (
          <span />
        )}
        <span className="num shrink-0 text-xs whitespace-nowrap text-text-muted">
          {formatHC(market.volume)} vol
        </span>
      </div>
    </article>
  );
}
