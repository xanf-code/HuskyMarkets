import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OutcomeState } from "@/lib/outcomes";
import type { HistoryPoint } from "@/lib/queries/markets";
import { ProbabilityChart } from "./ProbabilityChart";

const outcome = (overrides: Partial<OutcomeState>): OutcomeState => ({
  id: "o1",
  label: "Alpha",
  sortOrder: 0,
  pool: 100,
  implied: 17,
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

const history: HistoryPoint[] = six.map((o) => ({
  recordedAt: "2026-07-18T12:00:00Z",
  outcomeId: o.id,
  price: o.implied,
}));

function legendLabels(): string[] {
  return screen
    .getByRole("list", { name: "Chart outcomes" })
    .querySelectorAll("li span[data-label]")
    .values()
    .map((el) => el.textContent ?? "")
    .toArray();
}

describe("ProbabilityChart", () => {
  it("shows an empty state before the first price snapshot", () => {
    render(<ProbabilityChart history={[]} outcomes={six} variant="desktop" />);

    expect(
      screen.getByText(/awaiting the first price snapshot/i),
    ).toBeInTheDocument();
  });

  it("labels every outcome line on desktop (not color-only, NFR-7)", () => {
    render(
      <ProbabilityChart history={history} outcomes={six} variant="desktop" />,
    );

    expect(legendLabels()).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
      "Delta",
      "Epsilon",
      "Zeta",
    ]);
  });

  it("caps the mobile legend at top-3 by pool plus an 'Other' aggregate (NFR-6)", () => {
    render(
      <ProbabilityChart history={history} outcomes={six} variant="mobile" />,
    );

    expect(legendLabels()).toEqual(["Beta", "Delta", "Zeta", "Other"]);
  });

  it("keeps the legend's color swatches decorative - text carries identity", () => {
    render(
      <ProbabilityChart history={history} outcomes={six} variant="desktop" />,
    );

    const list = screen.getByRole("list", { name: "Chart outcomes" });
    for (const swatch of list.querySelectorAll("[data-swatch]")) {
      expect(swatch).toHaveAttribute("aria-hidden", "true");
    }
  });
});
