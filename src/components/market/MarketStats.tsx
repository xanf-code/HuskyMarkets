import { formatHC } from "@/lib/format";

interface MarketStatsProps {
  yesPool: number;
  noPool: number;
  volume: number;
  bettorCount: number;
}

export function MarketStats({
  yesPool,
  noPool,
  volume,
  bettorCount,
}: MarketStatsProps) {
  const stats = [
    { label: "Volume", value: formatHC(volume) },
    { label: "Bettors", value: String(bettorCount) },
    { label: "Yes / No pool", value: `${yesPool} / ${noPool}` },
  ];

  return (
    <dl className="grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-page px-4 py-3">
          <dt className="eyebrow text-text-muted">{stat.label}</dt>
          <dd className="num mt-1 text-lg text-text">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
