"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

/**
 * Once-per-session guest invite at the bottom of the board.
 * Visible card with Sign in + Dismiss — no surprise modal on scroll.
 */
export function GuestScrollPrompt() {
  const { promptSignIn } = useSignInPrompt();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // Private mode — still show the invite.
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage unavailable — hide for this mount only.
    }
    setVisible(false);
  }

  function onSignIn() {
    dismiss();
    promptSignIn();
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Sign in to place bets"
      className="card-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-balance text-text">
          You&apos;re browsing as a guest
        </p>
        <p className="mt-1 text-pretty text-sm text-text-muted">
          Sign in with your Northeastern email to place your first bet — free
          HuskyCoin, no real money.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={onSignIn}>
          Sign in
        </Button>
        <Button type="button" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </aside>
  );
}
