import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketGrid } from "./MarketGrid";

vi.mock("./Sparkline", () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));

function item(id: string, title: string): MarketListItem {
  return {
    id,
    title,
    category: "campus",
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: "2026-07-10T00:00:00Z",
    yesPool: 100,
    noPool: 100,
    impliedYes: 50,
    volume: 0,
    spark: [50],
  };
}

describe("MarketGrid", () => {
  it("renders a card per market", () => {
    render(
      <MarketGrid
        markets={[item("a", "First test market title"), item("b", "Second test market title")]}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows a terminal-flat empty state when nothing matches", () => {
    render(<MarketGrid markets={[]} />);
    expect(screen.getByText(/no open markets/i)).toBeInTheDocument();
  });
});
