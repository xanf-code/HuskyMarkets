import { Suspense } from "react";
import { MarketFilters } from "@/components/market/MarketFilters";
import { MarketGridLive } from "@/components/market/MarketGridLive";
import {
  CATEGORIES,
  MARKET_SORTS,
  type Category,
  type MarketSort,
} from "@/lib/constants";
import { getMarketList } from "@/lib/queries/markets";

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  const category = first(params.category);
  const sort = first(params.sort);
  const markets = await getMarketList({
    category: CATEGORIES.some((c) => c.value === category)
      ? (category as Category)
      : undefined,
    sort: MARKET_SORTS.includes(sort as MarketSort)
      ? (sort as MarketSort)
      : undefined,
    q: first(params.q),
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Suspense>
        <MarketFilters />
      </Suspense>
      <MarketGridLive initial={markets} />
    </div>
  );
}
