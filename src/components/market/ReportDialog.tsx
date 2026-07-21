"use client";

import { useState, type FormEvent } from "react";
import { submitReport } from "@/actions/reports";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { InlineError } from "@/components/ui/InlineError";

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
    try {
      const result = await submitReport({ marketId, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      setReason("");
    } catch {
      setError("Couldn't submit the report. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
        className="inline-flex min-h-11 self-start items-center rounded-md border border-hairline px-3 text-sm font-semibold text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-red"
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
            <label htmlFor="report-reason" className="block min-w-0">
              <span className="mb-2 block text-sm font-semibold text-text">
                Why is this market a problem?
              </span>
              <textarea
                id="report-reason"
                required
                rows={4}
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "report-reason-error" : undefined}
                className={`w-full min-w-0 rounded-md border ${error ? "border-red" : "border-hairline"} bg-card px-4 py-3 text-base text-text focus:border-red focus:outline-none`}
              />
              <span className="mt-1 block text-xs text-text-tertiary">
                {reason.length}/1000
              </span>
            </label>
            {error ? (
              <InlineError id="report-reason-error">{error}</InlineError>
            ) : null}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Submitting…" : "Submit report"}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
