"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { handleReportAction } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";
import type { ReportQueueItem } from "@/lib/queries/admin";

export function ReportQueue({ items }: { items: ReportQueueItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(reportId: string, action: "dismiss" | "action") {
    setError(null);
    setBusy(`${reportId}:${action}`);
    const result = await handleReportAction({ reportId, action });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="num text-sm text-text-muted">&gt; report queue empty_</p>
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
        {items.map((r) => (
          <li key={r.id} className="bg-page p-4 sm:p-5">
            <Link
              href={`/market/${r.marketId}`}
              className="font-serif text-lg text-text hover:text-red-bright focus-visible:outline-red"
            >
              {r.marketTitle}
            </Link>
            <p className="mt-2 text-sm text-text">{r.reason}</p>
            <p className="num mt-1 text-xs text-text-muted">
              {r.reporterName} · {timeAgo(r.createdAt)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => act(r.id, "dismiss")}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => act(r.id, "action")}
              >
                Void + remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
