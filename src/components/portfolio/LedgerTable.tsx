import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { HcAmount } from "@/components/ui/HcAmount";
import { timeAgo } from "@/lib/format";
import type { LedgerEntry } from "@/lib/queries/portfolio";

const TYPE_LABELS: Record<string, string> = {
  signup_grant: "Welcome bonus",
  daily_bonus: "Daily bonus",
  bailout: "Bailout",
  bet_place: "Bet",
  bet_payout: "Payout",
  market_refund: "Refund",
  vig_burn: "House fee",
};

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Ledger is quiet"
        description="Stakes, bonuses, and payouts land here once you play."
        action={
          <Link
            href="/"
            className="text-sm font-semibold text-red hover:text-red-hover focus-visible:outline-red"
          >
            Browse markets
          </Link>
        }
      />
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
            <p className="truncate text-sm font-semibold text-text">
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
          <div className="shrink-0 text-right">
            <p
              className={`flex items-center justify-end gap-0.5 text-sm font-semibold ${
                e.amount > 0 ? "text-market-yes" : "text-text"
              }`}
            >
              {e.amount > 0 ? <span aria-hidden="true">+</span> : null}
              <HcAmount amount={e.amount} size={14} />
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
