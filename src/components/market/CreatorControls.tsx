"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteOwnMarket, lockOwnMarket } from "@/actions/markets";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { InlineError } from "@/components/ui/InlineError";
import { useToast } from "@/components/ui/Toast";
import type { Database } from "@/lib/database.types";

type MarketStatus = Database["public"]["Enums"]["market_status"];

interface CreatorControlsProps {
  marketId: string;
  status: MarketStatus;
  hasBets: boolean;
}

export function CreatorControls({
  marketId,
  status,
  hasBets,
}: CreatorControlsProps) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"lock" | "delete" | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isSettled =
    status === "resolved" || status === "voided";

  async function handleLock() {
    setError(null);
    setBusy("lock");
    const result = await lockOwnMarket({ marketId });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.push("Pool closed to new bets.");
    router.refresh();
  }

  async function handleDelete() {
    setError(null);
    setBusy("delete");
    const result = await deleteOwnMarket({ marketId });
    setBusy(null);
    setShowDeleteDialog(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.push("Pool voided -all stakes refunded.");
    router.refresh();
  }

  return (
    <div className="card-surface flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-text">Your pool</h2>

      {error ? <InlineError>{error}</InlineError> : null}

      <div className="flex flex-col gap-2">
        {hasBets ? (
          <div className="rounded-md border border-hairline bg-muted px-4 py-3 text-sm text-text-muted">
            Editing locked -bets have been placed.
          </div>
        ) : (
          <Link
            href={`/market/${marketId}/edit`}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold text-text transition-colors duration-200 ease-standard hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
          >
            Edit pool
          </Link>
        )}

        {status === "open" ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleLock}
            loading={busy === "lock"}
            disabled={busy !== null}
          >
            Close to new bets
          </Button>
        ) : null}

        {!isSettled ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowDeleteDialog(true)}
            disabled={busy !== null}
          >
            Delete pool (void &amp; refund)
          </Button>
        ) : null}
      </div>

      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete this pool?"
      >
        <p className="text-sm text-text-muted">
          {hasBets
            ? "All bets will be fully refunded. This cannot be undone."
            : "The pool will be permanently deleted. This cannot be undone."}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteDialog(false)}
            disabled={busy === "delete"}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            loading={busy === "delete"}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
