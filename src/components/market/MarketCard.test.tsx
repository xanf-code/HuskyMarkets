import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketCard } from "./MarketCard";

vi.mock("./Sparkline", () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));

const market: MarketListItem = {
  id: "m1",
  title: "Will it snow in Boston before finals week?",
  category: "weather",
  closeAt: new Date(Date.now() + 86_400_000).toISOString(),
  createdAt: "2026-07-10T00:00:00Z",
  yesPool: 450,
  noPool: 300,
  impliedYes: 60,
  volume: 550,
  spark: [50, 67, 60],
};

describe("MarketCard", () => {
  it("links to the market detail page", () => {
    render(<MarketCard market={market} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/market/m1");
  });

  it("shows the price, volume, category, and sparkline", () => {
    render(<MarketCard market={market} />);
    expect(screen.getByText("YES 60¢")).toBeInTheDocument();
    expect(screen.getByText(/550 HC/)).toBeInTheDocument();
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline")).toBeInTheDocument();
  });
});
