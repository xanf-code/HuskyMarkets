"use client";

import { useEffect, useState } from "react";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { Button } from "./Button";

export interface UseLoadMoreOptions {
  pageSize?: number;
  /** When this changes (e.g. filter navigation), visible count resets. */
  resetKey?: string | number;
}

export function useLoadMore<T>(
  items: readonly T[],
  options: UseLoadMoreOptions = {},
) {
  const pageSize = options.pageSize ?? LIST_PAGE_SIZE;
  const resetKey = options.resetKey;
  const [visible, setVisible] = useState(pageSize);

  useEffect(() => {
    setVisible(pageSize);
  }, [resetKey, pageSize]);

  const capped = Math.min(visible, items.length);
  const visibleItems = items.slice(0, capped);
  const hasMore = capped < items.length;
  const remaining = items.length - capped;

  function loadMore() {
    setVisible((v) => Math.min(v + pageSize, items.length));
  }

  return { visibleItems, hasMore, remaining, loadMore };
}

export function LoadMoreButton({
  hasMore,
  remaining,
  onLoadMore,
}: {
  hasMore: boolean;
  remaining: number;
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center pt-4">
      <Button type="button" variant="secondary" onClick={onLoadMore}>
        Load more{remaining > 0 ? ` · ${remaining} left` : ""}
      </Button>
    </div>
  );
}
