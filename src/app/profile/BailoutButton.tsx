"use client";

import { useState } from "react";
import { claimBailout } from "@/actions/bonus";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { useToast } from "@/components/ui/Toast";
import { BAILOUT } from "@/lib/constants";

export function BailoutButton() {
  const { push } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  async function onClaim() {
    setMessage(null);
    setClaiming(true);
    try {
      const result = await claimBailout();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if (!result.claimed) {
        setMessage(
          "You already took a bailout this week — the next one unlocks Monday (ET).",
        );
        return;
      }
      push(`+${BAILOUT} HC — back in the game`);
    } catch {
      setMessage("Couldn't claim the bailout. Check your connection and try again.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        loading={claiming}
        onClick={onClaim}
        className="w-full sm:w-auto"
      >
        {claiming ? "Claiming…" : `Claim ${BAILOUT} HC bailout`}
      </Button>
      {message ? <InlineError>{message}</InlineError> : null}
    </div>
  );
}
