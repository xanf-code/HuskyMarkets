// Chart series selection for multi-outcome probability charts (FR-26).
//
// Desktop renders one line per outcome; mobile caps at the top-3 outcomes by
// current pool plus a single "Other" aggregate so 6-outcome charts stay
// legible on small screens (NFR-6). Identity is always carried by the series
// label, never by color alone (NFR-7).

import { sortByOutcomeOrder, type OutcomeState } from "./outcomes";

export type ChartVariant = "desktop" | "mobile";

export interface ChartSeries {
  /** Outcome id, or the sentinel "other" for the mobile aggregate. */
  key: string;
  label: string;
  /** Palette index (outcome sort_order); -1 for the neutral "Other". */
  colorIndex: number;
  /** Outcome ids aggregated into this series (exactly one, except "Other"). */
  outcomeIds: string[];
}

const MOBILE_TOP = 3;

export function buildChartSeries(
  outcomes: readonly OutcomeState[],
  variant: ChartVariant,
): ChartSeries[] {
  const ordered = sortByOutcomeOrder(outcomes);
  if (variant === "desktop" || ordered.length <= MOBILE_TOP) {
    return ordered.map((o) => ({
      key: o.id,
      label: o.label,
      colorIndex: o.sortOrder,
      outcomeIds: [o.id],
    }));
  }

  const topIds = new Set(
    [...ordered]
      .sort((a, b) => b.pool - a.pool || a.sortOrder - b.sortOrder)
      .slice(0, MOBILE_TOP)
      .map((o) => o.id),
  );
  const top = ordered.filter((o) => topIds.has(o.id));
  const rest = ordered.filter((o) => !topIds.has(o.id));

  return [
    ...top.map((o) => ({
      key: o.id,
      label: o.label,
      colorIndex: o.sortOrder,
      outcomeIds: [o.id],
    })),
    {
      key: "other",
      label: "Other",
      colorIndex: -1,
      outcomeIds: rest.map((o) => o.id),
    },
  ];
}
