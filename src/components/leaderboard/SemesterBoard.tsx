"use client";

import {
  InfiniteScrollSentinel,
  useLoadMore,
} from "@/components/ui/LoadMore";
import { HcAmount } from "@/components/ui/HcAmount";
import { LEADERBOARD_PAGE_SIZE } from "@/lib/constants";
import type { SemesterEntry } from "@/lib/queries/leaderboard";

interface SemesterBoardProps {
  entries: SemesterEntry[];
  currentUserId?: string;
}

export function SemesterBoard({ entries, currentUserId }: SemesterBoardProps) {
  const { visibleItems, hasMore, remaining, loadMore, visibleCount } =
    useLoadMore(entries, { pageSize: LEADERBOARD_PAGE_SIZE });

  if (entries.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        Nobody on the board yet this semester. Place a bet to climb.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">
        If you claimed a bailout this week, you&apos;re hidden until next Monday
        (ET).
      </p>
      <ol className="card-surface divide-y divide-hairline overflow-hidden">
        {visibleItems.map((e) => {
          const mine = e.userId === currentUserId;
          return (
            <li
              key={e.userId}
              className={`flex items-baseline gap-3 px-3 py-3 sm:gap-4 sm:px-5 ${
                mine ? "bg-muted" : "bg-card"
              }`}
            >
              <span className="num w-8 shrink-0 text-xl font-semibold text-red sm:w-10 sm:text-2xl">
                {e.rank}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm sm:text-base ${
                  mine ? "font-bold text-text" : "text-text"
                }`}
              >
                {e.displayName}
                {mine ? " (you)" : ""}
              </span>
              <span className="shrink-0 text-sm font-semibold text-text">
                <HcAmount amount={e.score} size={14} />
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
