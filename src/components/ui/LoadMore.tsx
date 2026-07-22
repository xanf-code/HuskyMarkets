"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
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

  // Reset on filter navigation via guarded setState during render - React's
  // sanctioned "adjust state when props change" pattern (same as OrderPanel).
  const [prevReset, setPrevReset] = useState({ resetKey, pageSize });
  if (prevReset.resetKey !== resetKey || prevReset.pageSize !== pageSize) {
    setPrevReset({ resetKey, pageSize });
    setVisible(pageSize);
  }

  const capped = Math.min(visible, items.length);
  const visibleItems = items.slice(0, capped);
  const hasMore = capped < items.length;
  const remaining = items.length - capped;

  const loadMore = useCallback(() => {
    setVisible((v) => Math.min(v + pageSize, items.length));
  }, [pageSize, items.length]);

  return { visibleItems, hasMore, remaining, loadMore, visibleCount: capped };
}

/**
 * Fires `onLoadMore` when the sentinel enters the viewport (with a generous
 * rootMargin so the next page is ready before the user hits the fold - key
 * on mobile where thumb-scroll is continuous).
 */
export function InfiniteScrollSentinel({
  hasMore,
  onLoadMore,
  remaining,
  visibleCount,
  rootMargin = "280px 0px",
}: {
  hasMore: boolean;
  onLoadMore: () => void;
  remaining?: number;
  /** Re-check intersection after each page so a still-visible sentinel keeps loading. */
  visibleCount: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useInfiniteScroll({
    ref,
    hasMore,
    onLoadMore,
    visibleCount,
    rootMargin,
  });

  if (!hasMore) return null;

  return (
    <div
      ref={ref}
      className="flex min-h-10 items-center justify-center px-4 py-3 sm:py-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs text-text-muted">
        {remaining != null && remaining > 0
          ? `${remaining} more`
          : "Loading…"}
      </p>
    </div>
  );
}

function useInfiniteScroll({
  ref,
  hasMore,
  onLoadMore,
  visibleCount,
  rootMargin,
}: {
  ref: RefObject<HTMLElement | null>;
  hasMore: boolean;
  onLoadMore: () => void;
  visibleCount: number;
  rootMargin: string;
}) {
  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, visibleCount, rootMargin, ref]);
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
