"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const TICK_STYLE = {
  fill: "rgba(255,255,255,0.72)",
  fontFamily: "var(--font-plex-mono), monospace",
  fontSize: 11,
};

const TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

interface ProbabilityChartProps {
  /** Implied-YES snapshots, oldest → newest. Live-appended in Phase 7. */
  history: { recordedAt: string; price: number }[];
}

export function ProbabilityChart({ history }: ProbabilityChartProps) {
  if (history.length === 0) {
    return (
      <div className="flex h-56 items-center border border-hairline px-4 sm:h-72">
        <p className="num text-sm text-text-muted">
          &gt; awaiting first price snapshot_
        </p>
      </div>
    );
  }

  const data = history.map((point) => ({
    t: new Date(point.recordedAt).getTime(),
    price: point.price,
  }));

  return (
    <div className="h-56 w-full sm:h-72" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => TIME.format(new Date(t))}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.28)" }}
            minTickGap={48}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}¢`}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
          />
          <Area
            type="stepAfter"
            dataKey="price"
            stroke="#e31837"
            strokeWidth={2}
            fill="rgba(227,24,55,0.12)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
