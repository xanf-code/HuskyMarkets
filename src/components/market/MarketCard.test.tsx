import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import { MarketCard } from "./MarketCard";

const market: MarketListItem = {
  id: "m1",
  title: "Will it snow in Boston before finals week?",
  category: "weather",
  closeAt: new Date(Date.now() + 86_400_000).toISOString(),
  createdAt: "2026-07-10T00:00:00Z",
  outcomes: [
    { id: "o-yes", label: "Yes", sortOrder: 0, pool: 450, implied: 60 },
    { id: "o-no", label: "No", sortOrder: 1, pool: 300, implied: 40 },
  ],
  volume: 550,
  bettorCount: 3,
  spark: [50, 67, 60],
  change24h: null,
};

describe("MarketCard", () => {
  it("links the card to the market detail page", () => {
    render(<MarketCard market={market} />);
    expect(
      screen.getByRole("heading", { level: 3 }).closest("a"),
    ).toHaveAttribute("href", "/market/m1");
  });

  it("shows both outcomes as price affordances for a binary market", () => {
    render(<MarketCard market={market} />);
    expect(screen.getByRole("link", { name: /bet yes/i })).toHaveAttribute(
      "href",
      "/market/m1?outcome=o-yes",
    );
    expect(screen.getByRole("link", { name: /bet no/i })).toHaveAttribute(
      "href",
      "/market/m1?outcome=o-no",
    );
  });

  it("shows the top-2 outcomes plus a '+N more' badge for 3+-outcome markets", () => {
    render(
      <MarketCard
        market={{
          ...market,
          outcomes: [
            { id: "o-a", label: "Alpha", sortOrder: 0, pool: 100, implied: 20 },
            { id: "o-b", label: "Beta", sortOrder: 1, pool: 300, implied: 60 },
            { id: "o-c", label: "Gamma", sortOrder: 2, pool: 100, implied: 20 },
          ],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /bet beta/i })).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("collapses a 6-outcome market to the top-2 by pool plus '+4 more'", () => {
    const outcomes = Array.from({ length: 6 }, (_, i) => ({
      id: `o-${i}`,
      label: `Outcome ${i + 1}`,
      sortOrder: i,
      pool: 100,
      implied: 17,
    }));
    outcomes[3].pool = 500;
    outcomes[3].implied = 56;
    outcomes[1].pool = 200;
    outcomes[1].implied = 22;

    render(<MarketCard market={{ ...market, outcomes }} />);

    expect(
      screen.getByRole("link", { name: /bet outcome 4/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /bet outcome 2/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /bet outcome 1/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("+4 more")).toBeInTheDocument();
  });

  it("leads with the leading outcome's probability percentage", () => {
    render(<MarketCard market={market} />);
    expect(screen.getAllByText("60%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
  });

  it("shows category, volume, bettors, and pool without a sparkline", () => {
    const { container } = render(<MarketCard market={market} />);
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByLabelText("550 HC")).toBeInTheDocument();
    expect(screen.getByText("Predictors")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Pool")).toBeInTheDocument();
    expect(screen.getByLabelText("750 HC")).toBeInTheDocument();
    expect(container.querySelector("[data-testid=sparkline]")).toBeNull();
    const title = screen.getByRole("heading", { level: 3 });
    expect(title).toHaveTextContent(market.title);
    expect(title.className).not.toMatch(/font-serif/);
    expect(container.querySelector(".eyebrow")).toBeNull();
  });
});
