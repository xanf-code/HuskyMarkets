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
    kind: "yes" | "no" | "void" | "lock",
  ) {
    setError(null);
    setBusy(`${marketId}:${kind}`);
    const result =
      kind === "lock"
        ? await lockMarketAction({ marketId })
        : await resolveMarketAction({ marketId, outcome: kind });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="num text-sm text-text-muted">&gt; resolve queue empty_</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm text-red-bright">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-px border border-hairline bg-hairline">
        {items.map((m) => (
          <li key={m.id} className="bg-page p-4 sm:p-5">
            <Link
              href={`/market/${m.id}`}
              className="font-serif text-lg text-text hover:text-red-bright focus-visible:outline-red"
            >
              {m.title}
            </Link>
            <p className="mt-1 text-xs text-text-muted">
              {m.status}
              {m.reportCount > 0 ? ` · ${m.reportCount} reports` : ""}
              {m.autoFlagged ? " · auto-flagged" : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["yes", "no", "void"] as const).map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant={outcome === "void" ? "secondary" : "primary"}
                  disabled={busy !== null}
                  onClick={() => act(m.id, outcome)}
                >
                  {outcome.toUpperCase()}
                </Button>
              ))}
              {m.status === "open" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => act(m.id, "lock")}
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
