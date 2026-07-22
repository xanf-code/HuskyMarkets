"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  InfiniteScrollSentinel,
  LoadMoreButton,
  useLoadMore,
} from "@/components/ui/LoadMore";
import { timeAgo } from "@/lib/format";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import type { CreatedMarket } from "@/lib/queries/portfolio";
import type { Database } from "@/lib/database.types";

type MarketStatus = Database["public"]["Enums"]["market_status"];

const STATUS_LABELS: Record<MarketStatus, string> = {
  open: "Open",
  closed: "Closed",
  resolved: "Resolved",
  voided: "Voided",
  pending: "Pending review",
  rejected: "Rejected",
};

interface CreatedMarketsListProps {
  markets: CreatedMarket[];
}

export function CreatedMarketsList({ markets }: CreatedMarketsListProps) {
  const { visibleItems, hasMore, remaining, loadMore, visibleCount } =
    useLoadMore(markets, { pageSize: LIST_PAGE_SIZE });

  if (markets.length === 0) {
    return (
      <EmptyState
        title="No markets created yet"
        description="Markets you create will appear here."
        action={
          <Link
            href="/create"
            className="text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-red"
          >
            Create a market
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="card-surface divide-y divide-hairline overflow-hidden">
        {visibleItems.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${m.id}`}
                className="line-clamp-2 text-sm font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {m.title}
              </Link>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-text-muted">
                {STATUS_LABELS[m.status]}
              </p>
              <p className="num mt-0.5 text-xs text-text-muted">
                {timeAgo(m.createdAt)}
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
