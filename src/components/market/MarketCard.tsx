import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { CATEGORIES } from "@/lib/constants";
import { formatCents, formatHC, formatPercent } from "@/lib/format";
import type { MarketListItem } from "@/lib/queries/markets";
import { Countdown } from "./Countdown";
import { Sparkline } from "./Sparkline";

export function MarketCard({ market }: { market: MarketListItem }) {
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;
  const impliedNo = 100 - market.impliedYes;

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

      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Yes probability"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={market.impliedYes}
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-muted"
        >
          <div
            className="h-full rounded-pill bg-market-yes transition-[width] duration-200 ease-standard"
            style={{ width: `${market.impliedYes}%` }}
          />
        </div>
        <span className="num shrink-0 text-sm font-semibold text-text">
          {formatPercent(market.impliedYes)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/market/${market.id}?side=yes`}
          aria-label={`Yes ${formatCents(market.impliedYes)}`}
          className="flex items-center justify-between rounded-md border border-market-yes/40 bg-market-yes-bg px-3 py-2.5 text-sm font-semibold text-market-yes transition-transform duration-200 ease-standard hover:scale-[0.98] focus-visible:outline-red"
        >
          <span>Yes</span>
          <span className="num">{formatCents(market.impliedYes)}</span>
        </Link>
        <Link
          href={`/market/${market.id}?side=no`}
          aria-label={`No ${formatCents(impliedNo)}`}
          className="flex items-center justify-between rounded-md border border-market-no/40 bg-market-no-bg px-3 py-2.5 text-sm font-semibold text-market-no transition-transform duration-200 ease-standard hover:scale-[0.98] focus-visible:outline-red"
        >
          <span>No</span>
          <span className="num">{formatCents(impliedNo)}</span>
        </Link>
      </div>

      <div className="flex items-end justify-between gap-3 pt-1">
        <Sparkline points={market.spark} />
        <span className="num text-xs text-text-muted">
          {formatHC(market.volume)} vol
        </span>
      </div>
    </article>
  );
}
