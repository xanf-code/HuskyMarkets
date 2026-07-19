import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { CATEGORIES } from "@/lib/constants";
import { formatCents, formatHC } from "@/lib/format";
import type { MarketListItem } from "@/lib/queries/markets";
import { Countdown } from "./Countdown";
import { Sparkline } from "./Sparkline";

export function MarketCard({ market }: { market: MarketListItem }) {
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;

  return (
    <Link
      href={`/market/${market.id}`}
      className="group flex flex-col gap-4 bg-page p-4 transition-colors duration-200 ease-standard hover:bg-ink focus-visible:outline-red sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <Chip>{categoryLabel}</Chip>
        <Countdown closeAt={market.closeAt} />
      </div>
      <h3 className="font-serif text-lg leading-snug text-text group-hover:underline sm:text-xl">
        {market.title}
      </h3>
      <Sparkline points={market.spark} />
      <div className="flex items-baseline justify-between gap-3">
        <span className="num text-2xl font-medium text-red-bright">
          YES {formatCents(market.impliedYes)}
        </span>
        <span className="num text-sm text-text-muted">
          {formatHC(market.volume)} vol
        </span>
      </div>
    </Link>
  );
}
