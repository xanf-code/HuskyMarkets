"use client";

import { useSignInPrompt } from "./SignInPromptProvider";

export function GuestHeroBanner() {
  const { promptSignIn } = useSignInPrompt();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-text">
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
