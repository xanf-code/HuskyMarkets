"use client";

import { Button } from "@/components/ui/Button";
import { useSignInPrompt } from "./SignInPromptProvider";

/** Slim first-run hook for guests above the board - invitation, not interruption. */
export function GuestWelcome() {
  const { promptSignIn } = useSignInPrompt();

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
