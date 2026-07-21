"use client";

import { useEffect } from "react";
import { LockedPanel } from "@/components/auth/LockedPanel";
import { useSignInPrompt } from "@/components/auth/SignInPromptProvider";

/**
 * Guest state for /leaderboard: placeholder rows behind the fade-lock, and
 * the sign-in dialog opens automatically on navigation. Dismissible — the
 * fade-lock stays behind it. No board queries fire server-side.
 */
export function LockedLeaderboard() {
  const { promptSignIn } = useSignInPrompt();

  useEffect(() => {
    promptSignIn();
  }, [promptSignIn]);

  return <LockedPanel variant="leaderboard" />;
}
