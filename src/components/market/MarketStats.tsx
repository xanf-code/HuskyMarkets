import type { ReactNode } from "react";
import { HcAmount } from "@/components/ui/HcAmount";
import type { OutcomeState } from "@/lib/outcomes";

interface MarketStatsProps {
  outcomes: OutcomeState[];
  volume: number;
  bettorCount: number;
}

export function MarketStats({
  outcomes,
  volume,
  bettorCount,
}: MarketStatsProps) {
  const stats: { label: string; value: ReactNode }[] = [
    { label: "Volume", value: <HcAmount amount={volume} /> },
    { label: "Predictors", value: String(bettorCount) },
    {
      label: "Pools",
      value: outcomes.map((o) => `${o.label} ${o.pool}`).join(" / "),
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card-surface px-4 py-3">
          <dt className="text-xs font-medium text-text-muted">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-text">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
