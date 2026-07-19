"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/**
 * Tiny trend line for market cards: recent implied-YES prices, no axes,
 * no interaction — the red stroke on black is the whole story.
 */
export function Sparkline({ points }: { points: number[] }) {
  const data = points.map((price, i) => ({ i, price }));

  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
        >
          <YAxis domain={[0, 100]} hide />
          <Line
            type="stepAfter"
            dataKey="price"
            stroke="#e31837"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
