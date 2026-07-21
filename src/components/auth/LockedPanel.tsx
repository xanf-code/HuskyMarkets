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

const FAKE_ACTIVITY = [
  { verb: "Bought", outcome: "Yes", stake: "40 HC (62%)", when: "2m ago" },
  { verb: "Bought", outcome: "No", stake: "25 HC (38%)", when: "5m ago" },
  { verb: "Bought", outcome: "Yes", stake: "100 HC (71%)", when: "12m ago" },
  { verb: "Bought", outcome: "No", stake: "15 HC (29%)", when: "18m ago" },
  { verb: "Bought", outcome: "Yes", stake: "50 HC (55%)", when: "1h ago" },
] as const;

const FAKE_LEADERS = [
  { name: "huskynova", amount: "2,840 HC" },
  { name: "snell.odds", amount: "2,210 HC" },
  { name: "curry.takes", amount: "1,975 HC" },
  { name: "quadqueen", amount: "1,640 HC" },
  { name: "centennial", amount: "1,420 HC" },
  { name: "iv.sharp", amount: "1,180 HC" },
  { name: "marino.mode", amount: "990 HC" },
  { name: "fenway.bet", amount: "870 HC" },
] as const;

function FakeActivityRows() {
  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {FAKE_ACTIVITY.map((row, i) => (
        <li
          key={i}
          className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <span className="text-market-yes">{row.verb}</span>
              <span className="text-text-muted"> · </span>
              <span className="text-text">{row.outcome}</span>
            </p>
            <p className="num mt-0.5 text-xs text-text-muted">{row.stake}</p>
          </div>
          <span className="num shrink-0 pt-0.5 text-xs text-text-muted">
            {row.when}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FakeLeaderboardRows() {
  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {FAKE_LEADERS.map((row, i) => (
        <li
          key={row.name}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="num w-6 shrink-0 text-sm text-text-muted">
              {i + 1}
            </span>
            <span className="truncate text-sm font-semibold text-text">
              {row.name}
            </span>
          </span>
          <span className="num shrink-0 text-sm text-text">{row.amount}</span>
        </li>
      ))}
    </ul>
  );
}

export function LockedPanel({ variant }: LockedPanelProps) {
  const { promptSignIn } = useSignInPrompt();
  const label =
    variant === "activity"
      ? "Sign in to view activity"
      : "Sign in to view rankings";

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[2px] opacity-60"
      >
        {variant === "activity" ? <FakeActivityRows /> : <FakeLeaderboardRows />}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-page/10 via-page/60 to-page/90 px-4 text-center">
        <p className="text-balance text-sm font-semibold text-text">{label}</p>
        <button
          type="button"
          onClick={promptSignIn}
          className="rounded-md border border-border-strong bg-card px-4 py-2 text-sm font-semibold text-text transition-[colors,transform] duration-200 ease-standard hover:bg-muted active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
