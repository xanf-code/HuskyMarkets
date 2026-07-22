"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  InfiniteScrollSentinel,
  LoadMoreButton,
  useLoadMore,
} from "@/components/ui/LoadMore";
import { HcAmount } from "@/components/ui/HcAmount";
import { timeAgo } from "@/lib/format";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import type { BetHistoryRow } from "@/lib/queries/portfolio";

interface BetHistoryListProps {
  rows: BetHistoryRow[];
}

export function BetHistoryList({ rows }: BetHistoryListProps) {
  const { visibleItems, hasMore, remaining, loadMore, visibleCount } =
    useLoadMore(rows, { pageSize: LIST_PAGE_SIZE });

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No bets placed yet"
        description="Every bet you place will appear here."
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
    <div className="flex flex-col gap-3">
      <ul className="card-surface divide-y divide-hairline overflow-hidden">
        {visibleItems.map((r) => (
          <li
            key={r.betId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${r.marketId}`}
                className="line-clamp-2 text-sm font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {r.marketTitle}
              </Link>
              <p className="mt-0.5 text-xs text-text-muted">{r.outcomeLabel}</p>
            </div>
            <div className="shrink-0 text-right">
              <HcAmount amount={r.amount} size={13} />
              <p className="num mt-0.5 text-xs text-text-muted">
                {timeAgo(r.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <LoadMoreButton
        hasMore={hasMore}
        remaining={remaining}
        onLoadMore={loadMore}
      />
      <InfiniteScrollSentinel
        hasMore={hasMore}
        onLoadMore={loadMore}
        remaining={remaining}
        visibleCount={visibleCount}
      />
    </div>
  );
}
