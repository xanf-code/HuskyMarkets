"use client";

import {
  InfiniteScrollSentinel,
  useLoadMore,
} from "@/components/ui/LoadMore";
import { ACTIVITY_PAGE_SIZE } from "@/lib/constants";
import { formatCents, formatHC, timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/queries/markets";

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  const { visibleItems, hasMore, remaining, loadMore, visibleCount } =
    useLoadMore(activity, { pageSize: ACTIVITY_PAGE_SIZE });

  if (activity.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-6 text-center text-sm text-text-muted">
        No bets yet — be the first.
      </p>
    );
  }

  return (
    <div>
      <ul className="card-surface divide-y divide-hairline overflow-hidden">
        {visibleItems.map((bet) => (
          <li
            key={bet.id}
            className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="text-market-yes">Bought</span>
                <span className="text-text-muted"> · </span>
                <span className="text-text">{bet.outcomeLabel}</span>
              </p>
              <p className="num mt-0.5 text-xs text-text-muted">
                {formatHC(bet.amount)} ({formatCents(bet.price)})
              </p>
            </div>
            <span className="num shrink-0 pt-0.5 text-xs text-text-muted">
              {timeAgo(bet.createdAt)}
            </span>
          </li>
        ))}
      </ul>
      <InfiniteScrollSentinel
        hasMore={hasMore}
        onLoadMore={loadMore}
        remaining={remaining}
        visibleCount={visibleCount}
      />
    </div>
  );
}
