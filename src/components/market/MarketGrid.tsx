import type { MarketListItem } from "@/lib/queries/markets";
import { MarketCard } from "./MarketCard";

export function MarketGrid({ markets }: { markets: MarketListItem[] }) {
  if (markets.length === 0) {
    return (
      <div className="border border-hairline px-4 py-10 sm:px-6">
        <p className="num text-sm text-text-muted">
          &gt; no open markets match this filter_
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
