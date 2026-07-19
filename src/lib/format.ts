// Display formatting for HuskyCoin amounts, prices, and market timing.

import { HOUSE_SEED } from "@/lib/constants";

const HC = new Intl.NumberFormat("en-US");

export function formatHC(amount: number): string {
  return `${HC.format(amount)} HC`;
}

/** Implied probability (1–99) rendered Kalshi-style: "63¢". */
export function formatCents(price: number): string {
  return `${price}¢`;
}

/** Primary card/detail probability label: "62%". */
export function formatPercent(price: number): string {
  return `${price}%`;
}

/** Real money wagered: pools minus the 100/100 house seed. */
export function marketVolume(yesPool: number, noPool: number): number {
  return Math.max(yesPool + noPool - 2 * HOUSE_SEED, 0);
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
