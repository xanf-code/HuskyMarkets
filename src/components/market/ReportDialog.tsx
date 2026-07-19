"use client";

import { useState, type FormEvent } from "react";
import { submitReport } from "@/actions/reports";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface ReportDialogProps {
  marketId: string;
}

export function ReportDialog({ marketId }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await submitReport({ marketId, reason });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setDone(false);
          setError(null);
        }}
        className="self-start rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-red"
      >
        Report market
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Report market"
      >
        {done ? (
          <p className="text-sm text-text-muted">
            Report filed. Staff will review it.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label htmlFor="report-reason" className="block">
              <span className="mb-2 block text-sm font-semibold text-text">
                Why is this market a problem?
              </span>
              <textarea
                id="report-reason"
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-hairline bg-card px-4 py-3 text-base text-text focus:border-red focus:outline-none"
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-market-no">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Submitting…" : "Submit report"}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
