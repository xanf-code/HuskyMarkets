"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { isPromoBannerDismissed } from "@/lib/onboarding-flags";
import { useSignInPrompt } from "./SignInPromptProvider";

/** Slim first-run hook for guests above the board - invitation, not interruption.
 *  Only renders after the promo banner has been dismissed, so the two CTAs
 *  never appear at the same time. */
export function GuestWelcome() {
  const { promptSignIn } = useSignInPrompt();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isPromoBannerDismissed());
  }, []);

  if (!show) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <p className="min-w-0 text-pretty text-sm text-text">
        <span className="font-semibold">Predict campus events.</span>{" "}
        <span className="text-text-muted">
          Stake free HuskyCoin, climb the board, share the wins.
        </span>
      </p>
      <Button
        type="button"
        size="sm"
        onClick={promptSignIn}
        className="shrink-0 self-start sm:self-auto"
      >
        Join with Northeastern email
      </Button>
    </div>
  );
}
