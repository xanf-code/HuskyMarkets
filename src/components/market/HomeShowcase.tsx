import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import type { MarketListItem } from "@/lib/queries/markets";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <EmptyState
        title="No open markets right now"
        description="Check back soon — or start one and get the board moving."
        action={
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href="/create"
              className="text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-red"
            >
              Create a market
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm font-semibold text-text-muted hover:text-text focus-visible:outline-red"
            >
              View leaderboard
            </Link>
          </div>
        }
      />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 [&>article]:h-full">
              {list.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  hideCategory
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
