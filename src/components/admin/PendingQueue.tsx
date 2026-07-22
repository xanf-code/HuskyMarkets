"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewMarketAction } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineError } from "@/components/ui/InlineError";
import { timeAgo } from "@/lib/format";
import type { PendingMarketItem } from "@/lib/queries/admin";

export function PendingQueue({ items }: { items: PendingMarketItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(marketId: string, action: "approve" | "reject") {
    setError(null);
    setBusy(`${marketId}:${action}`);
    const result = await reviewMarketAction({ marketId, action });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return <EmptyState title="No markets pending review" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <InlineError>{error}</InlineError> : null}
      <ul className="card-surface divide-y divide-hairline overflow-hidden">
        {items.map((m) => (
          <li key={m.id} className="bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-2">
              <Link
                href={`/market/${m.id}`}
                className="line-clamp-2 flex-1 text-lg font-semibold text-text hover:text-red focus-visible:outline-red"
              >
                {m.title}
              </Link>
              {m.autoFlagged ? (
                <span className="shrink-0 rounded-full bg-red/10 px-2 py-0.5 text-xs font-semibold text-red">
                  auto-flagged
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs text-text-muted">
              {m.creatorName} · {m.category} · closes {timeAgo(m.closeAt)} ·
              submitted {timeAgo(m.createdAt)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy !== null}
                loading={busy === `${m.id}:approve`}
                onClick={() => act(m.id, "approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                loading={busy === `${m.id}:reject`}
                onClick={() => act(m.id, "reject")}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
