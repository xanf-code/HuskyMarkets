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

function LockGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="size-5 text-text-muted"
    >
      <path
        fillRule="evenodd"
        d="M10 1a3.5 3.5 0 0 0-3.5 3.5V6H5.5A1.5 1.5 0 0 0 4 7.5v8A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 14.5 6H13.5V4.5A3.5 3.5 0 0 0 10 1Zm-1.5 5V4.5a1.5 1.5 0 0 1 3 0V6h-3Zm1.5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LockedPanel({ variant }: LockedPanelProps) {
  const { promptSignIn } = useSignInPrompt();
  const headline =
    variant === "activity"
      ? "See who's betting on this"
      : "See who's climbing the board";
  const subcopy =
    variant === "activity"
      ? "Sign in to unlock recent activity."
      : "Sign in to view rankings — and your spot.";

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[2px] opacity-60"
      >
        {variant === "activity" ? <FakeActivityRows /> : <FakeLeaderboardRows />}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-page/10 via-page/60 to-page/90 px-4 text-center">
        <LockGlyph />
        <div className="flex max-w-sm flex-col gap-1">
          <p className="text-balance text-sm font-semibold text-text">
            {headline}
          </p>
          <p className="text-pretty text-xs text-text-muted">{subcopy}</p>
        </div>
        <button
          type="button"
          onClick={promptSignIn}
          className="rounded-md border border-border-strong bg-card px-4 py-2 text-sm font-semibold text-text transition-[colors,transform] duration-200 ease-standard hover:bg-muted active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          Sign in to view
        </button>
      </div>
    </div>
  );
}
