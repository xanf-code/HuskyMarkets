import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BetOgCard } from "./BetOgCard";
import { MarketOgCard } from "./MarketOgCard";

describe("MarketOgCard", () => {
  const card = {
    title: "Will it snow before finals?",
    category: "weather" as const,
    yesPrice: 63,
    volume: 550,
    status: "open" as const,
    closeAt: "2026-07-21T02:00:00Z", // Jul 20 in ET
  };

  it("renders title, category eyebrow, giant YES price, volume, close date and wordmark", () => {
    render(<MarketOgCard card={card} />);
    expect(screen.getByText("Will it snow before finals?")).toBeInTheDocument();
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("YES 63¢")).toBeInTheDocument();
    expect(screen.getByText(/550 HC/)).toBeInTheDocument();
    expect(screen.getByText(/Jul 20/)).toBeInTheDocument();
    expect(screen.getByText("HuskyMarkets")).toBeInTheDocument();
  });
});

describe("BetOgCard", () => {
  const card = {
    marketId: "m1",
    marketTitle: "Will it snow before finals?",
    side: "no" as const,
    priceAtBet: 22,
    stake: 250,
    payout: 396,
    displayName: "QuietHusky42",
  };

  it("renders called-it price, title, stake to payout, display name and wordmark", () => {
    render(<BetOgCard card={card} />);
    expect(screen.getByText(/Called it at 22¢/)).toBeInTheDocument();
    expect(screen.getByText("Will it snow before finals?")).toBeInTheDocument();
    expect(screen.getByText(/250 HC/)).toBeInTheDocument();
    expect(screen.getByText(/396 HC/)).toBeInTheDocument();
    expect(screen.getByText(/QuietHusky42/)).toBeInTheDocument();
    expect(screen.getByText("HuskyMarkets")).toBeInTheDocument();
  });
});
