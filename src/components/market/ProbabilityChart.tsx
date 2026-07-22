"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from "recharts";
import { buildChartSeries, type ChartVariant } from "@/lib/chart-series";
import { formatPercent } from "@/lib/format";
import type { OutcomeState } from "@/lib/outcomes";
import type { HistoryPoint } from "@/lib/queries/markets";
import { outcomeColor, theme } from "@/lib/theme";
import { useAppearance } from "@/lib/use-appearance";

const TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

/** Kalshi-style crosshair card: time on top, series values sorted high → low. */
function CrosshairTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  const rows = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div className="card-surface min-w-36 px-3 py-2 shadow-card-hover">
      <p className="num pb-1 text-xs font-semibold text-text">
        {DATE_TIME.format(new Date(label))}
      </p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li
            key={String(row.dataKey)}
            className="num flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden="true"
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="truncate text-text-muted">{row.name}</span>
            <span
              className="ml-auto pl-3 font-semibold"
              style={{ color: row.color }}
            >
              {formatPercent(row.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const appearance = useAppearance();
  const colors = appearance === "dark" ? theme.darkColors : theme.colors;
  const tickStyle = {
    fill: colors.textMuted,
    fontFamily: theme.fonts.sans,
    fontSize: 11,
  };

  // Drag-to-zoom is pointer/mouse only - on phones it fights vertical scroll,
  // so the mobile chart variant keeps tooltip taps and skips the zoom gesture.
  const chartVariant = variant ?? detected;
  const zoomEnabled = chartVariant === "desktop";

  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  const labelToNumber = (state: MouseHandlerDataParam): number | null => {
    const { activeLabel } = state;
    return activeLabel === undefined ? null : Number(activeLabel);
  };

  const handleMouseDown = (state: MouseHandlerDataParam) => {
    if (!zoomEnabled) return;
    const value = labelToNumber(state);
    if (value === null) return;
    setDragStart(value);
    setDragEnd(value);
  };

  const handleMouseMove = (state: MouseHandlerDataParam) => {
    if (!zoomEnabled || dragStart === null) return;
    const value = labelToNumber(state);
    if (value === null) return;
    setDragEnd(value);
  };

  const commitZoom = () => {
    if (!zoomEnabled) return;
    if (dragStart !== null && dragEnd !== null && dragStart !== dragEnd) {
      setZoomDomain([
        Math.min(dragStart, dragEnd),
        Math.max(dragStart, dragEnd),
      ]);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const resetZoom = () => setZoomDomain(null);

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
        out[s.key] = s.outcomeIds.reduce((sum, id) => sum + (row[id] ?? 0), 0);
      }
      return out;
    });

  const colorFor = (colorIndex: number) =>
    colorIndex < 0 ? colors.marketNeutral : outcomeColor(colorIndex);

  return (
    <div className="card-surface w-full overflow-hidden">
      <div className="relative">
        {zoomDomain && (
          <button
            type="button"
            onClick={resetZoom}
            className="absolute right-2 top-2 z-10 inline-flex min-h-11 items-center rounded-full border border-hairline bg-card px-3 text-sm text-text-muted transition-colors duration-200 ease-standard hover:text-text focus-visible:outline-red"
          >
            Reset zoom
          </button>
        )}
        <div
          className="h-56 w-full select-none px-1 pt-2 sm:h-72 sm:px-2 [&_*]:outline-none"
          aria-hidden="true"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={commitZoom}
              onMouseLeave={commitZoom}
            >
              <CartesianGrid stroke={colors.hairline} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={zoomDomain ?? ["dataMin", "dataMax"]}
                allowDataOverflow
                tickFormatter={(t: number) => TIME.format(new Date(t))}
                tick={tickStyle}
                tickLine={false}
                axisLine={{ stroke: colors.hairline }}
                minTickGap={48}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              {dragStart === null && (
                <Tooltip
                  content={<CrosshairTooltip />}
                  cursor={{
                    stroke: colors.textTertiary,
                    strokeWidth: 1,
                  }}
                />
              )}
              {dragStart !== null &&
                dragEnd !== null &&
                dragStart !== dragEnd && (
                  <ReferenceArea
                    x1={Math.min(dragStart, dragEnd)}
                    x2={Math.max(dragStart, dragEnd)}
                    stroke={colors.textTertiary}
                    strokeOpacity={0.4}
                    fill={colors.textTertiary}
                    fillOpacity={0.12}
                  />
                )}
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={colorFor(s.colorIndex)}
                  strokeWidth={2}
                  fill={`${colorFor(s.colorIndex)}1F`}
                  activeDot={{
                    r: 3.5,
                    strokeWidth: 2,
                    stroke: colors.card,
                  }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Labels, not color alone, carry outcome identity (NFR-7). */}
      <ul
        aria-label="Chart outcomes"
        className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3"
      >
        {series.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-1.5 text-xs text-text-muted"
          >
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
