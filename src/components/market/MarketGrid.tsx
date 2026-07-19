import type { MarketListItem } from "@/lib/queries/markets";
import { MarketCard } from "./MarketCard";

export function MarketGrid({ markets }: { markets: MarketListItem[] }) {
  if (markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted px-4 py-12 text-center sm:px-6">
        <p className="text-sm text-text-muted">
          No markets match these filters.
        </p>
      </div>
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
