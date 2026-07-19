import Link from "next/link";
import { formatHC, timeAgo } from "@/lib/format";
import type { LedgerEntry } from "@/lib/queries/portfolio";

const TYPE_LABELS: Record<string, string> = {
  signup_grant: "Signup grant",
  daily_bonus: "Daily bonus",
  bailout: "Bailout",
  bet_place: "Bet",
  bet_payout: "Payout",
  market_refund: "Refund",
  vig_burn: "Vig burn",
};

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        Ledger empty.
      </p>
    );
  }

  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">
              {TYPE_LABELS[e.type] ?? e.type}
            </p>
            {e.marketId && e.marketTitle ? (
              <Link
                href={`/market/${e.marketId}`}
                className="mt-0.5 block truncate text-sm text-text-muted hover:text-red focus-visible:outline-red"
              >
                {e.marketTitle}
              </Link>
            ) : null}
          </div>
          <div className="text-right">
            <p
              className={`num text-sm font-semibold ${
                e.amount > 0 ? "text-market-yes" : "text-text"
              }`}
            >
              {e.amount > 0 ? "+" : ""}
              {formatHC(e.amount)}
            </p>
            <p className="num mt-0.5 text-xs text-text-muted">
              {timeAgo(e.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
