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
    <div className="flex flex-col gap-6 sm:gap-8">
      <div>
        <p className="eyebrow text-red-bright">
          Virtual HuskyCoin · Northeastern only
        </p>
        <h1 className="mt-2 font-serif text-3xl text-text sm:text-4xl">
          Markets
        </h1>
      </div>
      <Suspense>
        <MarketFilters />
      </Suspense>
      <MarketGridLive initial={markets} />
    </div>
  );
}
