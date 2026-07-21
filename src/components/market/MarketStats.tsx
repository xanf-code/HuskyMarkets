import type { ReactNode } from "react";
import { HcAmount } from "@/components/ui/HcAmount";
import type { OutcomeState } from "@/lib/outcomes";

interface MarketStatsProps {
  outcomes: OutcomeState[];
  volume: number;
  /** Null for guests: predictor counts are locked with the activity feed. */
  bettorCount: number | null;
}

export function MarketStats({
  outcomes,
  volume,
  bettorCount,
}: MarketStatsProps) {
  const stats: { label: string; value: ReactNode }[] = [
    { label: "Volume", value: <HcAmount amount={volume} /> },
    {
      label: "Predictors",
      value:
        bettorCount === null ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-label="Locked"
            className="inline-block h-5 w-5 opacity-40"
          >
            <path
              fillRule="evenodd"
              d="M8 1a3 3 0 0 0-3 3v1H3.5A1.5 1.5 0 0 0 2 6.5v7A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 5H11V4a3 3 0 0 0-3-3Zm-1.5 4V4a1.5 1.5 0 0 1 3 0v1h-3Zm1.5 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          String(bettorCount)
        ),
    },
    {
      label: "Pools",
      value: (
        <ul className="flex flex-col gap-0.5">
          {outcomes.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-text-muted">{o.label}</span>
              <span className="num shrink-0 font-semibold text-text">{o.pool}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card-surface px-4 py-3">
          <dt className="text-xs font-medium text-text-muted">{stat.label}</dt>
          <dd className={`mt-1 text-text ${stat.label === "Pools" ? "" : "text-lg font-semibold"}`}>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
