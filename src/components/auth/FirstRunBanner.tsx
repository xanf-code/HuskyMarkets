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
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card px-4 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text text-balance">
          Place a take. Climb the board.
        </p>
        <p className="mt-1 text-pretty text-sm text-text-muted">
          Odds are the chance others imply. Stake free HuskyCoin — one bet puts
          your name on the leaderboard. Wins unlock a share card.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={dismiss}
        className="shrink-0 self-start sm:self-auto"
      >
        Got it
      </Button>
    </div>
  );
}
