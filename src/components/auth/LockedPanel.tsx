"use client";

// Fade-lock for guest-gated content: static placeholder rows (never real
// data — the server skips those queries entirely) behind a gradient overlay
// with a sign-in prompt. Used for the market activity feed and, via
// LockedLeaderboard, the leaderboard.

import { useSignInPrompt } from "./SignInPromptProvider";

export type LockedPanelVariant = "activity" | "leaderboard";

interface LockedPanelProps {
  variant: LockedPanelVariant;
}

function FakeActivityRows() {
  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {Array.from({ length: 5 }, (_, i) => (
        <li
          key={i}
          className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <span className="text-market-yes">Bought</span>
              <span className="text-text-muted"> · </span>
              <span className="text-text">Outcome</span>
            </p>
            <p className="num mt-0.5 text-xs text-text-muted">25 HC (50%)</p>
          </div>
          <span className="num shrink-0 pt-0.5 text-xs text-text-muted">
            just now
          </span>
        </li>
      ))}
    </ul>
  );
}

function FakeLeaderboardRows() {
  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {Array.from({ length: 8 }, (_, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="num w-6 shrink-0 text-sm text-text-muted">
              {i + 1}
            </span>
            <span className="truncate text-sm font-semibold text-text">
              Husky
            </span>
          </span>
          <span className="num shrink-0 text-sm text-text">1,000 HC</span>
        </li>
      ))}
    </ul>
  );
}

export function LockedPanel({ variant }: LockedPanelProps) {
  const { promptSignIn } = useSignInPrompt();

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[2px] opacity-60"
      >
        {variant === "activity" ? <FakeActivityRows /> : <FakeLeaderboardRows />}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-page/10 via-page/60 to-page/90 px-4">
        <p className="text-sm font-semibold text-text">
          {variant === "activity"
            ? "Recent activity is for members"
            : "The leaderboard is for members"}
        </p>
        <button
          type="button"
          onClick={promptSignIn}
          className="rounded-md border border-border-strong bg-card px-4 py-2 text-sm font-semibold text-text transition-colors duration-200 ease-standard hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          Sign in to view
        </button>
      </div>
    </div>
  );
}
