import Link from "next/link";
import type { MarketListItem } from "@/lib/queries/markets";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarketCard } from "./MarketCard";

export function MarketGrid({ markets }: { markets: MarketListItem[] }) {
  if (markets.length === 0) {
    return (
      <EmptyState
        title="No markets match"
        description="Clear filters or try a different search."
        action={
          <Link
            href="/"
            className="text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-red"
          >
            Browse all markets
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
