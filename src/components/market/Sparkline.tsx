"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { outcomeColor } from "@/lib/theme";

interface SparklineProps {
  points: number[];
  /**
   * Label of the outcome this sparkline tracks (the market's leading
   * outcome, A-2). Named explicitly because the leader can change as pools
   * move — the trend line must always say whose trend it is (AR-8).
   */
  label: string;
  /** Outcome sort_order; picks the series color from the shared palette. */
  colorIndex: number;
  /** Sizing override; defaults to the tiny card height. */
  className?: string;
}

/** Tiny trend line for market cards: recent implied prices, no axes. */
export function Sparkline({
  points,
  label,
  colorIndex,
  className = "h-10 w-full",
}: SparklineProps) {
  const data = points.map((price, i) => ({ i, price }));

  return (
    <div
      className={className}
      role="img"
      aria-label={`${label} price trend`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
        >
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="price"
            stroke={outcomeColor(colorIndex)}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
