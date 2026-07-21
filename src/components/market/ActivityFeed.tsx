"use client";

import {
  InfiniteScrollSentinel,
  useLoadMore,
} from "@/components/ui/LoadMore";
import { EmptyState } from "@/components/ui/EmptyState";
import { HcAmount } from "@/components/ui/HcAmount";
import { ACTIVITY_PAGE_SIZE } from "@/lib/constants";
import { formatPercent, timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/queries/markets";

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  const { visibleItems, hasMore, remaining, loadMore, visibleCount } =
    useLoadMore(activity, { pageSize: ACTIVITY_PAGE_SIZE });

  if (activity.length === 0) {
    return (
      <EmptyState
        title="No bets yet"
        description="Be the first — pick an outcome on the ticket above."
        className="py-8"
      />
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
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                <span className="text-market-yes">Bought</span>
                <span className="text-text-muted"> · </span>
                <span className="break-words text-text">{bet.outcomeLabel}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-text-muted">
                <HcAmount amount={bet.amount} size={12} />
                <span className="num">({formatPercent(bet.price)})</span>
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
