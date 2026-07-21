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
          Predict campus events. Win bragging rights.
        </p>
        <p className="text-sm text-text-muted">
          Free to play with virtual HuskyCoin!
        </p>
      </div>
      <button
        type="button"
        onClick={promptSignIn}
        aria-label="Get started with HuskyMarkets"
        className="shrink-0 rounded-md bg-red px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-hover focus-visible:outline-red"
      >
        Get started free
      </button>
    </div>
  );
}
