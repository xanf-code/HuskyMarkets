import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketStats } from "./MarketStats";

describe("MarketStats", () => {
  it("shows volume, bettor count, and the per-outcome pools", () => {
    render(
      <MarketStats
        outcomes={[
          { id: "o-yes", label: "Yes", sortOrder: 0, pool: 450, implied: 60 },
          { id: "o-no", label: "No", sortOrder: 1, pool: 300, implied: 40 },
        ]}
        volume={550}
        bettorCount={3}
      />,
    );
    expect(screen.getByLabelText("550 HC")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    // Pools render as one row per outcome.
    const pools = screen.getByRole("list");
    expect(pools).toHaveTextContent("Yes");
    expect(pools).toHaveTextContent("450");
    expect(pools).toHaveTextContent("No");
    expect(pools).toHaveTextContent("300");
  });

  it("renders a lock icon for the predictor count when it is locked for guests", () => {
    render(
      <MarketStats
        outcomes={[
          { id: "o-yes", label: "Yes", sortOrder: 0, pool: 450, implied: 60 },
        ]}
        volume={550}
        bettorCount={null}
      />,
    );

    const predictors = screen.getByText("Predictors").parentElement!;
    expect(predictors.querySelector('svg[aria-label="Locked"]')).toBeInTheDocument();
    expect(predictors.textContent).not.toContain("0");
  });
});
