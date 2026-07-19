import { formatCents, formatHC, timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/queries/markets";

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <p className="num text-sm text-text-muted">
        &gt; no bets yet — be the first_
      </p>
    );
  }

  return (
    <ul className="divide-y divide-hairline border border-hairline">
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
              bet.side === "yes" ? "text-red-bright" : "text-text"
            }`}
          >
            {bet.side.toUpperCase()}
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
