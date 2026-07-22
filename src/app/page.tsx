import { Suspense } from "react";
import { FirstRunBanner } from "@/components/auth/FirstRunBanner";
import { GuestScrollPrompt } from "@/components/auth/GuestScrollPrompt";
import { GuestWelcome } from "@/components/auth/GuestWelcome";
import { HomeShowcase } from "@/components/market/HomeShowcase";
import { getTopMovers, HomeSidebar } from "@/components/market/HomeSidebar";
import { MarketFilters } from "@/components/market/MarketFilters";
import { MarketGridLive } from "@/components/market/MarketGridLive";
import {
  CATEGORIES,
  MARKET_SORTS,
  type Category,
  type MarketSort,
} from "@/lib/constants";
import { getSession, verifySession } from "@/lib/dal";
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
  const q = first(params.q);
  const filters = {
    category: CATEGORIES.some((c) => c.value === category)
      ? (category as Category)
      : undefined,
    sort: MARKET_SORTS.includes(sort as MarketSort)
      ? (sort as MarketSort)
      : undefined,
    q,
  };
  if (filters.category) await verifySession();
  const markets = await getMarketList(filters);
  // React-cached in the layout too, so this session read is free.
  const session = await getSession();
  // Sidebar always reflects the *unfiltered* pool so the rail stays useful
  // while browsing a category. Cheap: campus-scale list already in memory.
  const allMarkets =
    filters.category || filters.q ? await getMarketList({}) : markets;

  const showGroups = !filters.category && !filters.q;
  const hasMovers = getTopMovers(allMarkets).length > 0;

  const moversRail = hasMovers ? (
    <aside className="hidden lg:sticky lg:top-24 lg:block">
      <HomeSidebar markets={allMarkets} layout="rail" />
    </aside>
  ) : null;

  const moversAfterFirst = hasMovers ? (
    <div className="lg:hidden">
      <HomeSidebar markets={allMarkets} />
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <h1 className="sr-only">HuskyMarkets - Campus Prediction Markets</h1>
      {!session ? <GuestWelcome /> : <FirstRunBanner />}
      {!showGroups && (
        <Suspense>
          <MarketFilters />
        </Suspense>
      )}
      {showGroups ? (
        <div
          className={
            hasMovers
              ? "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8"
              : undefined
          }
        >
          <HomeShowcase markets={markets} afterFirstSection={moversAfterFirst} />
          {moversRail}
        </div>
      ) : (
        <>
          {hasMovers ? <HomeSidebar markets={allMarkets} /> : null}
          <MarketGridLive initial={markets} />
        </>
      )}
      {!session && <GuestScrollPrompt />}
    </div>
  );
}
