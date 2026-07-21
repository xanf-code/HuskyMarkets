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
      value: bettorCount === null ? "—" : String(bettorCount),
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
