"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { theme } from "@/lib/theme";

const TICK_STYLE = {
  fill: theme.colors.textMuted,
  fontFamily: theme.fonts.sans,
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
      <div className="card-surface flex h-56 items-center justify-center px-4 sm:h-72">
        <p className="text-center text-sm text-text-muted">
          Awaiting the first price snapshot.
        </p>
      </div>
    );
  }

  const data = history.map((point) => ({
    t: new Date(point.recordedAt).getTime(),
    price: point.price,
  }));

  return (
    <div className="card-surface h-56 w-full overflow-hidden sm:h-72" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => TIME.format(new Date(t))}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={{ stroke: theme.colors.hairline }}
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
            stroke={theme.colors.marketYes}
            strokeWidth={2}
            fill={`${theme.colors.marketYes}1F`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
