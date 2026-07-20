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
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-3 text-sm sm:px-4"
          >
            <span className="font-semibold text-text">{bet.displayName}</span>
            <span className="text-text-muted">bet</span>
            <span className="num text-text">{formatHC(bet.amount)}</span>
            <span className="text-text-muted">on</span>
            <span className="num font-medium text-text">
              {bet.outcomeLabel}
            </span>
            <span className="num text-text-muted">
              @ {formatCents(bet.price)}
            </span>
            <span className="num ml-auto text-xs text-text-muted">
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
