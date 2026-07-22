"use client";

import { useState, useTransition } from "react";
import { setEmailNotifications } from "@/actions/profile";
import { InlineError } from "@/components/ui/InlineError";

interface EmailNotificationsToggleProps {
  /** Server-read preference, so the switch renders correctly on first paint. */
  initialEnabled: boolean;
}

export function EmailNotificationsToggle({
  initialEnabled,
}: EmailNotificationsToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    if (pending) return;
    const next = !enabled;
    // Optimistic flip; roll back if the action reports a failure.
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setEmailNotifications({ enabled: next });
      if (!result.ok) {
        setEnabled(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-text">
            Email me when my markets resolve
          </p>
          <p className="text-sm text-text-muted">
            {enabled
              ? "On - we'll email you on resolutions and voids."
              : "Off - you'll only see in-app notifications."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle email notifications"
          disabled={pending}
          onClick={onToggle}
          className={`relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center rounded-pill border transition-colors duration-200 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? "border-red bg-red" : "border-border-strong bg-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-5 rounded-pill bg-card shadow-card transition-transform duration-200 ease-standard ${
              enabled ? "translate-x-7" : "translate-x-1.5"
            }`}
          />
        </button>
      </div>
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}
