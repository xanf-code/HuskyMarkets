"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { lockMarketAction, resolveMarketAction } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import type { ResolveQueueItem } from "@/lib/queries/admin";

export function ResolveQueue({ items }: { items: ResolveQueueItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(
    marketId: string,
    kind: { action: "resolve"; winningOutcomeId: string } | { action: "void" } | { action: "lock" },
  ) {
    setError(null);
    setBusy(`${marketId}:${kind.action}`);
    const result =
      kind.action === "lock"
        ? await lockMarketAction({ marketId })
        : kind.action === "void"
          ? await resolveMarketAction({ marketId, action: "void" })
          : await resolveMarketAction({
              marketId,
              action: "resolve",
              winningOutcomeId: kind.winningOutcomeId,
            });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        Resolve queue is empty.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}
      <ul className="card-surface divide-y divide-hairline overflow-hidden">
        {items.map((m) => (
          <li key={m.id} className="bg-card p-4 sm:p-5">
            <Link
              href={`/market/${m.id}`}
              className="text-lg font-semibold text-text hover:text-red focus-visible:outline-red"
            >
              {m.title}
            </Link>
            <p className="mt-1 text-xs text-text-muted">
              {m.status}
              {m.reportCount > 0 ? ` · ${m.reportCount} reports` : ""}
              {m.autoFlagged ? " · auto-flagged" : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {m.outcomes.map((outcome) => (
                <Button
                  key={outcome.id}
                  size="sm"
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() =>
                    act(m.id, { action: "resolve", winningOutcomeId: outcome.id })
                  }
                >
                  {outcome.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => act(m.id, { action: "void" })}
              >
                Void
              </Button>
              {m.status === "open" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => act(m.id, { action: "lock" })}
                >
                  Lock
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
