"use client";

import { useSignInPrompt } from "./SignInPromptProvider";

/**
 * Orientation strip for guests — quiet surface so it leads into the board
 * without competing with the elevated conversion CTA at the bottom.
 */
export function GuestHeroBanner() {
  const { promptSignIn } = useSignInPrompt();

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
      <div className="flex flex-col gap-1">
        <p className="text-balance text-sm font-semibold text-text">
          Campus odds. Campus bragging rights.
        </p>
        <p className="text-sm text-text-muted">
          Browse the board. Sign in to stake HuskyCoin — play money, real pride.
        </p>
      </div>
      <button
        type="button"
        onClick={promptSignIn}
        aria-label="Sign in to HuskyMarkets"
        className="shrink-0 rounded-md bg-red px-4 py-2 text-sm font-semibold text-white transition-[colors,transform] duration-200 ease-standard hover:bg-red-hover active:scale-[0.98] focus-visible:outline-red"
      >
        Sign in
      </button>
    </div>
  );
}
