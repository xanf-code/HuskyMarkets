"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
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
    // Storage unavailable — modal will reappear on next mount, acceptable.
  }
}

/**
 * Invisible sentinel at the bottom of the guest board. When it scrolls into
 * view (once per session), a CTA modal invites the guest to sign in.
 */
export function GuestScrollPrompt() {
  const { promptSignIn } = useSignInPrompt();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (hasBeenPrompted()) return;
      observer.disconnect();
      setOpen(true);
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function dismiss() {
    markPrompted();
    setOpen(false);
  }

  function onSignIn() {
    dismiss();
    promptSignIn();
  }

  return (
    <>
      <div ref={sentinelRef} data-guest-sentinel aria-hidden="true" />
      <Dialog
        open={open}
        onClose={dismiss}
        title="Join HuskyMarkets"
      >
        <p className="text-sm text-text-muted">
          Sign in with your Northeastern email to place your first bet - free
          HuskyCoin, no real money.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={onSignIn}>
            Sign in
          </Button>
          <Button type="button" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </Dialog>
    </>
  );
}
