import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketCard } from "./MarketCard";

const CARDS_PER_CATEGORY = 6;

/**
 * Default home view: category grids (Kalshi-style). Each section shows up to
 * 6 markets; the header link opens the filtered full list.
 * Filtering/searching swaps this for the live grid.
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

      {CATEGORIES.map((category) => {
        const list = markets
          .filter((m) => m.category === category.value)
          .slice(0, CARDS_PER_CATEGORY);
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 [&>article]:h-full">
              {list.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
