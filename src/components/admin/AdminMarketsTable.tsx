"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setMarketHidden } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import type { AdminMarketRow } from "@/lib/queries/admin";

export function AdminMarketsTable({ markets }: { markets: AdminMarketRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function toggle(marketId: string, hidden: boolean) {
    setError(null);
    const result = await setMarketHidden({ marketId, hidden });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm text-red-bright">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-px border border-hairline bg-hairline">
        {markets.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 bg-page px-4 py-3 sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/market/${m.id}`}
                className="font-semibold text-text hover:text-red-bright focus-visible:outline-red"
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
    </div>
  );
}
