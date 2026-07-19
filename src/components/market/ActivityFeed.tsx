import { formatCents, formatHC, timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/queries/markets";

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-6 text-center text-sm text-text-muted">
        No bets yet — be the first.
      </p>
    );
  }

  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {activity.map((bet) => (
        <li
          key={bet.id}
          className="flex flex-wrap items-baseline gap-x-2 px-4 py-3 text-sm"
        >
          <span className="font-semibold text-text">{bet.displayName}</span>
          <span className="text-text-muted">bet</span>
          <span className="num text-text">{formatHC(bet.amount)}</span>
          <span className="text-text-muted">on</span>
          <span
            className={`num font-medium ${
              bet.side === "yes" ? "text-market-yes" : "text-market-no"
            }`}
          >
            {bet.side === "yes" ? "Yes" : "No"}
          </span>
          <span className="num text-text-muted">
            @ {formatCents(bet.price)}
          </span>
          <span className="num ml-auto text-xs text-text-muted">
            {timeAgo(bet.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
