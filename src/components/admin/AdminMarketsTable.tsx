"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setMarketHidden } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineError } from "@/components/ui/InlineError";
import type { AdminMarketRow } from "@/lib/queries/admin";

export function AdminMarketsTable({ markets }: { markets: AdminMarketRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? markets.filter((m) =>
        m.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : markets;

  async function toggle(marketId: string, hidden: boolean) {
    setError(null);
    const result = await setMarketHidden({ marketId, hidden });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (markets.length === 0) {
    return <EmptyState title="No markets to manage" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <InlineError>{error}</InlineError> : null}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search markets…"
        className="w-full rounded-md border border-hairline bg-card px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
      />
      {filtered.length === 0 ? (
        <EmptyState title={`No markets match "${query}"`} />
      ) : (
        <ul className="card-surface divide-y divide-hairline overflow-hidden">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-card px-4 py-3 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/market/${m.id}`}
                  className="line-clamp-2 font-semibold text-text hover:text-red focus-visible:outline-red"
                >
                  {m.title}
                </Link>
                <p className="num mt-1 text-xs text-text-muted">
                  {m.status}
                  {m.hidden ? " · hidden" : ""}
                  {m.autoFlagged ? " · auto-flagged" : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggle(m.id, !m.hidden)}
              >
                {m.hidden ? "Unhide" : "Hide"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
