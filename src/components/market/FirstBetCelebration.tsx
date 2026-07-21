"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface FirstBetCelebrationProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Aha moment after the first fill: you're on the semester board now;
 * share cards come when a take resolves your way.
 */
export function FirstBetCelebration({
  open,
  onClose,
}: FirstBetCelebrationProps) {
  return (
    <Dialog open={open} onClose={onClose} title="You're on the board">
      <p className="text-pretty text-sm text-text-muted">
        That stake put you on this semester&apos;s leaderboard. When a market
        resolves your way, Portfolio → Settled unlocks a share card for the
        win.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/leaderboard"
          onClick={onClose}
          className={buttonStyles({ size: "sm" })}
        >
          See the leaderboard
        </Link>
        <button
          type="button"
          onClick={onClose}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          Keep browsing
        </button>
      </div>
    </Dialog>
  );
}
