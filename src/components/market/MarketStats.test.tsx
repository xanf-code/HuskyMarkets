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
    expect(screen.getByText("Yes 450 / No 300")).toBeInTheDocument();
  });
});
