"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  clearFirstRun,
  isFirstRunPending,
} from "@/lib/onboarding-flags";

/**
 * Post-onboarding home cue for beginners: get them to a first bet that
 * lands them on the semester board (and sets up a future share card).
 * Matches GuestWelcome - muted invitation strip, not a lifted card.
 */
export function FirstRunBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isFirstRunPending());
  }, []);

  if (!visible) return null;

  function dismiss() {
    clearFirstRun();
    setVisible(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text text-balance">
          Place a take. Climb the board.
        </p>
        <p className="mt-1 text-pretty text-sm text-text-muted">
          One bet puts your name on the leaderboard. Wins unlock a share card.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={dismiss}
        className="shrink-0 self-start sm:self-auto"
      >
        Got it
      </Button>
    </div>
  );
}
