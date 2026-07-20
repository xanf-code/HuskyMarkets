import { describe, expect, it } from "vitest";
import type { OutcomeState } from "./outcomes";
import { buildChartSeries } from "./chart-series";

const outcome = (overrides: Partial<OutcomeState>): OutcomeState => ({
  id: "o1",
  label: "Alpha",
  sortOrder: 0,
  pool: 100,
  implied: 50,
  ...overrides,
});

const six: OutcomeState[] = [
  outcome({ id: "a", label: "Alpha", sortOrder: 0, pool: 100 }),
  outcome({ id: "b", label: "Beta", sortOrder: 1, pool: 300 }),
  outcome({ id: "c", label: "Gamma", sortOrder: 2, pool: 100 }),
  outcome({ id: "d", label: "Delta", sortOrder: 3, pool: 250 }),
  outcome({ id: "e", label: "Epsilon", sortOrder: 4, pool: 100 }),
  outcome({ id: "f", label: "Zeta", sortOrder: 5, pool: 150 }),
];

describe("buildChartSeries", () => {
  it("desktop renders one series per outcome in canonical sort_order", () => {
    const series = buildChartSeries(six, "desktop");

    expect(series.map((s) => s.key)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(series.map((s) => s.colorIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(series.every((s) => s.outcomeIds.length === 1)).toBe(true);
  });

  it("mobile caps at the top-3 outcomes by pool plus an 'Other' aggregate", () => {
    const series = buildChartSeries(six, "mobile");

    // Top-3 by pool: Beta (300), Delta (250), Zeta (150) — then Other.
    expect(series.map((s) => s.label)).toEqual([
      "Beta",
      "Delta",
      "Zeta",
      "Other",
    ]);
    const other = series.at(-1)!;
    expect(other.key).toBe("other");
    expect(other.outcomeIds).toEqual(["a", "c", "e"]);
  });

  it("keeps the top-3 series in sort_order, not pool order", () => {
    const series = buildChartSeries(six, "mobile");

    expect(series.slice(0, 3).map((s) => s.key)).toEqual(["b", "d", "f"]);
    expect(series.slice(0, 3).map((s) => s.colorIndex)).toEqual([1, 3, 5]);
  });

  it("shows every outcome on mobile when there are 3 or fewer", () => {
    const three = six.slice(0, 3);
    const series = buildChartSeries(three, "mobile");

    expect(series.map((s) => s.key)).toEqual(["a", "b", "c"]);
  });

  it("breaks pool ties by sort_order so equal pools never crash or flap", () => {
    const equal = six.map((o) => outcome({ ...o, pool: 100 }));
    const series = buildChartSeries(equal, "mobile");

    expect(series.slice(0, 3).map((s) => s.key)).toEqual(["a", "b", "c"]);
    expect(series.at(-1)!.outcomeIds).toEqual(["d", "e", "f"]);
  });

  it("handles a binary market identically on both variants", () => {
    const binary = six.slice(0, 2);

    expect(buildChartSeries(binary, "desktop").map((s) => s.key)).toEqual([
      "a",
      "b",
    ]);
    expect(buildChartSeries(binary, "mobile").map((s) => s.key)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns no series for an empty outcome list", () => {
    expect(buildChartSeries([], "desktop")).toEqual([]);
    expect(buildChartSeries([], "mobile")).toEqual([]);
  });
});
