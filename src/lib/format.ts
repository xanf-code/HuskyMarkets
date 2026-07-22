// Display formatting for HuskyCoin amounts, prices, and market timing.

import { HOUSE_SEED } from "@/lib/constants";

const HC = new Intl.NumberFormat("en-US");

/** Coerce non-finite amounts to 0 so UI never renders "NaN" / "Infinity". */
function safeAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0;
}

/** Thousands-separated amount with no unit - pair with HuskyCoinIcon in UI. */
export function formatHCNumber(amount: number): string {
  return HC.format(safeAmount(amount));
}

/**
 * Plain-string HuskyCoin amount for toasts, aria-labels, and meta descriptions
 * where the coin icon cannot render: "1,000 HC".
 */
export function formatHC(amount: number): string {
  return `${HC.format(safeAmount(amount))} HC`;
}

/** Implied probability (1–99) as a percent: "62%". */
export function formatPercent(price: number): string {
  if (!Number.isFinite(price)) return "-";
  return `${price}%`;
}

/** Real money wagered: total pool minus the 100 HC per-outcome house seed. */
export function marketVolume(totalPool: number, outcomeCount: number): number {
  return Math.max(totalPool - HOUSE_SEED * outcomeCount, 0);
}

/**
 * Compact countdown to a close time: "2d 3h", "3h 12m", "42m", "<1m",
 * or "closed" once past.
 */
export function formatCountdown(
  closeAt: string | Date,
  now: Date = new Date(),
): string {
  const target = typeof closeAt === "string" ? new Date(closeAt) : closeAt;
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "closed";

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";

  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/** Relative past time: "just now", "2m ago", "3h ago", "3d ago". */
export function timeAgo(date: string | Date, now: Date = new Date()): string {
  const past = typeof date === "string" ? new Date(date) : date;
  const minutes = Math.floor((now.getTime() - past.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
