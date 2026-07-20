"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { buildChartSeries, type ChartVariant } from "@/lib/chart-series";
import type { OutcomeState } from "@/lib/outcomes";
import type { HistoryPoint } from "@/lib/queries/markets";
import { outcomeColor, theme } from "@/lib/theme";

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

const MOBILE_QUERY = "(max-width: 640px)";

function subscribeMobile(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Mobile iff the viewport is narrow; desktop during SSR and pre-hydration. */
function useChartVariant(): ChartVariant {
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
  return mobile ? "mobile" : "desktop";
}

interface ProbabilityChartProps {
  /** Per-outcome price snapshots, oldest → newest. */
  history: HistoryPoint[];
  outcomes: OutcomeState[];
  /** Test/SSR override; defaults to live viewport detection. */
  variant?: ChartVariant;
}

export function ProbabilityChart({
  history,
  outcomes,
  variant,
}: ProbabilityChartProps) {
  const detected = useChartVariant();
  const series = buildChartSeries(outcomes, variant ?? detected);

  if (history.length === 0) {
    return (
      <div className="card-surface flex h-56 items-center justify-center px-4 sm:h-72">
        <p className="text-center text-sm text-text-muted">
          Awaiting the first price snapshot.
        </p>
      </div>
    );
  }

  // Pivot per-outcome rows into one row per timestamp, keyed by series.
  // Aggregate series ("Other") sum their member outcomes' prices.
  const byTimestamp = new Map<number, Record<string, number>>();
  for (const point of history) {
    const t = new Date(point.recordedAt).getTime();
    const row = byTimestamp.get(t) ?? { t };
    row[point.outcomeId] = point.price;
    byTimestamp.set(t, row);
  }
  const data = [...byTimestamp.values()]
    .sort((a, b) => a.t - b.t)
    .map((row) => {
      const out: Record<string, number> = { t: row.t };
      for (const s of series) {
        out[s.key] = s.outcomeIds.reduce(
          (sum, id) => sum + (row[id] ?? 0),
          0,
        );
      }
      return out;
    });

  const colorFor = (colorIndex: number) =>
    colorIndex < 0 ? theme.colors.marketNeutral : outcomeColor(colorIndex);

  return (
    <div className="card-surface w-full overflow-hidden">
      <div className="h-56 w-full sm:h-72" aria-hidden="true">
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
            {series.map((s) => (
              <Area
                key={s.key}
                type="stepAfter"
                dataKey={s.key}
                name={s.label}
                stroke={colorFor(s.colorIndex)}
                strokeWidth={2}
                fill={`${colorFor(s.colorIndex)}1F`}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Labels, not color alone, carry outcome identity (NFR-7). */}
      <ul
        aria-label="Chart outcomes"
        className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3"
      >
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span
              data-swatch
              aria-hidden="true"
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: colorFor(s.colorIndex) }}
            />
            <span data-label>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
