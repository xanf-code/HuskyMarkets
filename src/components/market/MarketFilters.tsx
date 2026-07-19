"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { CATEGORIES, MARKET_SORTS, type MarketSort } from "@/lib/constants";

const SORT_LABELS: Record<MarketSort, string> = {
  closing: "Closing soon",
  volume: "Volume",
  newest: "Newest",
};

/**
 * Category chips, sort, and search — all state lives in the URL so the
 * server component refetches on every change.
 */
export function MarketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "closing";

  function apply(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleCategory(value: string) {
    apply((params) => {
      if (activeCategory === value) params.delete("category");
      else params.set("category", value);
    });
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    apply((params) => {
      if (typeof q === "string" && q.trim()) params.set("q", q.trim());
      else params.delete("q");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/80 p-3 sm:gap-4 sm:p-4">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {CATEGORIES.map((category) => {
          const active = activeCategory === category.value;
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => toggleCategory(category.value)}
              aria-pressed={active}
              className={`shrink-0 cursor-pointer rounded-pill px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-standard focus-visible:outline-red ${
                active
                  ? "bg-red/10 text-red"
                  : "bg-card text-text-muted hover:text-text"
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={onSearch} className="min-w-0 flex-1" role="search">
          <input
            type="search"
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Search markets…"
            aria-label="Search markets"
            className="w-full rounded-md border border-hairline bg-card px-3.5 py-2.5 text-sm text-text placeholder:text-text-tertiary transition-colors duration-200 ease-standard focus:border-red focus:outline-none"
          />
        </form>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <span className="font-medium">Sort</span>
          <select
            value={activeSort}
            onChange={(event) =>
              apply((params) => {
                if (event.target.value === "closing") params.delete("sort");
                else params.set("sort", event.target.value);
              })
            }
            className="cursor-pointer rounded-md border border-hairline bg-card px-3 py-2.5 text-sm text-text focus:border-red focus:outline-none"
          >
            {MARKET_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
