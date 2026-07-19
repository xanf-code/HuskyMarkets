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
  it("links the card to the market detail page", () => {
    render(<MarketCard market={market} />);
    expect(
      screen.getByRole("link", { name: /will it snow in boston/i }),
    ).toHaveAttribute("href", "/market/m1");
  });

  it("shows dual Yes/No price affordances that deep-link a side", () => {
    render(<MarketCard market={market} />);
    expect(screen.getByRole("link", { name: /yes\s+60¢/i })).toHaveAttribute(
      "href",
      "/market/m1?side=yes",
    );
    expect(screen.getByRole("link", { name: /no\s+40¢/i })).toHaveAttribute(
      "href",
      "/market/m1?side=no",
    );
  });

  it("leads with a probability percentage, not a single red YES price", () => {
    render(<MarketCard market={market} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
  });

  it("shows category, volume, and sparkline without serif title chrome", () => {
    const { container } = render(<MarketCard market={market} />);
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText(/550 HC/)).toBeInTheDocument();
    expect(screen.getByTestId("sparkline")).toBeInTheDocument();
    const title = screen.getByRole("heading", { level: 3 });
    expect(title).toHaveTextContent(market.title);
    expect(title.className).not.toMatch(/font-serif/);
    expect(container.querySelector(".eyebrow")).toBeNull();
  });
});
