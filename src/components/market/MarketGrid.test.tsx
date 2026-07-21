import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketGrid } from "./MarketGrid";

function item(id: string, title: string): MarketListItem {
  return {
    id,
    title,
    category: "campus",
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: "2026-07-10T00:00:00Z",
    outcomes: [
      { id: `${id}-yes`, label: "Yes", sortOrder: 0, pool: 100, implied: 50 },
      { id: `${id}-no`, label: "No", sortOrder: 1, pool: 100, implied: 50 },
    ],
    volume: 0,
    bettorCount: 0,
    spark: [50],
  };
}

describe("MarketGrid", () => {
  it("renders a card per market in a gapped grid, not a hairline mosaic", () => {
    const { container } = render(
      <MarketGrid
        markets={[
          item("a", "First test market title"),
          item("b", "Second test market title"),
        ]}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    const grid = container.firstElementChild;
    expect(grid?.className).toMatch(/gap-/);
    expect(grid?.className).not.toMatch(/gap-px/);
  });

  it("shows a plain empty state when nothing matches", () => {
    render(<MarketGrid markets={[]} />);
    expect(
      screen.getByText(/no markets match\. clear filters/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/>/)).not.toBeInTheDocument();
  });
});
