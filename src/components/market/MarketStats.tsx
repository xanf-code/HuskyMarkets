import { formatHC } from "@/lib/format";
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
  const stats = [
    { label: "Volume", value: formatHC(volume) },
    { label: "Bettors", value: String(bettorCount) },
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
          <dd className="num mt-1 text-lg font-semibold text-text">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
