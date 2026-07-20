import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketCard } from "./MarketCard";
import { TrendingCarousel } from "./TrendingCarousel";

/**
 * Default home view: trending hero carousel, then a horizontally scrollable
 * row per category (Kalshi-style). Filtering/searching swaps this for the
 * live grid.
 */
export function HomeShowcase({ markets }: { markets: MarketListItem[] }) {
  if (markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted px-4 py-12 text-center sm:px-6">
        <p className="text-sm text-text-muted">
          No open markets right now — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <TrendingCarousel markets={markets} />

      {CATEGORIES.map((category) => {
        const list = markets.filter((m) => m.category === category.value);
        if (list.length === 0) return null;
        return (
          <section
            key={category.value}
            aria-label={`${category.label} markets`}
            className="flex flex-col gap-3"
          >
            <Link
              href={`/?category=${category.value}`}
              className="group w-fit focus-visible:outline-red"
            >
              <h2 className="text-lg font-semibold text-text transition-colors duration-200 ease-standard group-hover:text-red">
                {category.label}{" "}
                <span aria-hidden="true" className="text-text-muted">
                  ›
                </span>
              </h2>
            </Link>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {list.map((market) => (
                <div
                  key={market.id}
                  className="w-[17rem] shrink-0 snap-start sm:w-80 [&>article]:h-full"
                >
                  <MarketCard market={market} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
