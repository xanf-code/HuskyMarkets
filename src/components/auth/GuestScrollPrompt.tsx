"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

function hasBeenPrompted(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPrompted() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage unavailable - card may reappear on next mount, acceptable.
  }
}

/**
 * Visible end-of-board CTA for guests. Invitation strip (not a surprise
 * modal) — matches GuestWelcome / FirstRunBanner.
 */
export function GuestScrollPrompt() {
  const { promptSignIn } = useSignInPrompt();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasBeenPrompted());
  }, []);

  if (!visible) return null;

  function dismiss() {
    markPrompted();
    setVisible(false);
  }

  function onSignIn() {
    dismiss();
    promptSignIn();
  }

  return (
    <aside
      role="complementary"
      aria-label="Sign in to place bets"
      className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
    >
      <p className="min-w-0 text-pretty text-sm text-text">
        <span className="font-semibold">You&apos;re browsing as a guest.</span>{" "}
        <span className="text-text-muted">
          Sign in to place your first bet — free HuskyCoin, no real money.
        </span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
        <Button type="button" size="sm" onClick={onSignIn}>
          Sign in
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </aside>
  );
}
