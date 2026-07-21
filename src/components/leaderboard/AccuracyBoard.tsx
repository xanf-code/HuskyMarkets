"use client";

import Link from "next/link";
import {
  InfiniteScrollSentinel,
  useLoadMore,
} from "@/components/ui/LoadMore";
import { EmptyState } from "@/components/ui/EmptyState";
import { HcAmount } from "@/components/ui/HcAmount";
import { LEADERBOARD_PAGE_SIZE } from "@/lib/constants";
import type { AccuracyEntry } from "@/lib/queries/leaderboard";

interface AccuracyBoardProps {
  entries: AccuracyEntry[];
  currentUserId?: string;
}

export function AccuracyBoard({ entries, currentUserId }: AccuracyBoardProps) {
  const { visibleItems, hasMore, remaining, loadMore, visibleCount } =
    useLoadMore(entries, { pageSize: LEADERBOARD_PAGE_SIZE });

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Accuracy board is empty"
        description="Need at least 10 resolved bets to appear here."
        action={
          <Link
            href="/"
            className="text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-red"
          >
            Browse markets
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        Ranked by win rate on markets resolved this semester. Minimum 10
        resolved bets.
      </p>
      <ol className="card-surface divide-y divide-hairline overflow-hidden">
        {visibleItems.map((e) => {
          const mine = e.userId === currentUserId;
          return (
            <li
              key={e.userId}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-3 sm:gap-x-4 sm:px-5 ${
                mine ? "bg-muted" : "bg-card"
              }`}
            >
              <span className="num w-8 shrink-0 text-xl font-semibold text-red tabular-nums sm:w-10 sm:text-2xl">
                {e.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm sm:text-base ${
                  mine ? "font-bold text-text" : "text-text"
                }`}
              >
                {e.displayName}
              </span>
              <span className="num w-full text-sm text-text sm:ml-auto sm:w-auto">
                <span className="text-market-yes">
                  {(e.winRate * 100).toFixed(1)}%
                </span>
                {" · "}
                <span className="text-market-yes">{e.wins}W</span>/
                <span className="text-market-no">{e.losses}L</span>
                {" · "}
                <HcAmount amount={e.volume} size={12} />
              </span>
            </li>
          );
        })}
      </ol>
      <InfiniteScrollSentinel
        hasMore={hasMore}
        onLoadMore={loadMore}
        remaining={remaining}
        visibleCount={visibleCount}
      />
    </div>
  );
}
