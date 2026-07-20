"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { CATEGORIES } from "@/lib/constants";
import { formatCents, formatHC } from "@/lib/format";
import { leadingOutcome } from "@/lib/outcomes";
import type { MarketListItem } from "@/lib/queries/markets";
import { outcomeColor } from "@/lib/theme";
import { Countdown } from "./Countdown";
import { Sparkline } from "./Sparkline";

const FEATURED_COUNT = 5;
const OUTCOME_ROWS = 4;

/** Kalshi-style hero: top markets by volume, paged one at a time. */
export function TrendingCarousel({ markets }: { markets: MarketListItem[] }) {
  const featured = [...markets]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, FEATURED_COUNT);
  const [index, setIndex] = useState(0);

  if (featured.length === 0) return null;

  const current = Math.min(index, featured.length - 1);
  const market = featured[current];
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;
  const leader = leadingOutcome(market.outcomes);
  const rows = [...market.outcomes]
    .sort((a, b) => b.pool - a.pool || a.sortOrder - b.sortOrder)
    .slice(0, OUTCOME_ROWS);
  const more = market.outcomes.length - rows.length;

  return (
    <section aria-label="Trending markets" aria-roledescription="carousel">
      <article className="card-surface flex flex-col gap-5 p-5 sm:gap-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Chip>{categoryLabel}</Chip>
            <Countdown closeAt={market.closeAt} />
          </div>
          {featured.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous featured market"
                onClick={() =>
                  setIndex(
                    (current - 1 + featured.length) % featured.length,
                  )
                }
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-hairline bg-card text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text focus-visible:outline-red"
              >
                ‹
              </button>
              <span className="num text-xs text-text-muted">
                {current + 1} of {featured.length}
              </span>
              <button
                type="button"
                aria-label="Next featured market"
                onClick={() => setIndex((current + 1) % featured.length)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-hairline bg-card text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text focus-visible:outline-red"
              >
                ›
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
          <div className="flex min-w-0 flex-col gap-4">
            <Link
              href={`/market/${market.id}`}
              className="focus-visible:outline-red"
            >
              <h2 className="text-2xl leading-tight font-bold text-text sm:text-3xl">
                {market.title}
              </h2>
            </Link>

            <ul className="flex flex-col gap-1.5">
              {rows.map((outcome) => (
                <li
                  key={outcome.id}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: outcomeColor(outcome.sortOrder) }}
                  />
                  <span className="truncate font-medium text-text">
                    {outcome.label}
                  </span>
                  <span className="num ml-auto rounded-pill border border-hairline bg-muted px-2.5 py-0.5 text-xs font-semibold text-text">
                    {formatCents(outcome.implied)}
                  </span>
                </li>
              ))}
              {more > 0 ? (
                <li className="text-xs font-medium text-text-muted">
                  +{more} more
                </li>
              ) : null}
            </ul>

            <p className="num text-sm text-text-muted">
              {formatHC(market.volume)} vol
            </p>
          </div>

          {market.volume > 0 && market.spark.length >= 2 ? (
            <div aria-hidden="true">
              <Sparkline
                points={market.spark}
                label={leader?.label ?? "Leading outcome"}
                colorIndex={leader?.sortOrder ?? 0}
                className="h-28 w-full sm:h-44"
              />
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
