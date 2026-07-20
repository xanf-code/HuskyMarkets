import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BetOgCard } from "./BetOgCard";
import { MarketOgCard } from "./MarketOgCard";

describe("MarketOgCard", () => {
  const card = {
    title: "Will it snow before finals?",
    category: "weather" as const,
    leading: { label: "Yes", price: 63 },
    volume: 550,
    status: "open" as const,
    closeAt: "2026-07-21T02:00:00Z", // Jul 20 in ET
  };

  it("renders title, category eyebrow, leading outcome price, volume, close date and wordmark", () => {
    render(<MarketOgCard card={card} />);
    expect(screen.getByText("Will it snow before finals?")).toBeInTheDocument();
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("Yes 63¢")).toBeInTheDocument();
    expect(screen.getByText(/550 HC/)).toBeInTheDocument();
    expect(screen.getByText(/Jul 20/)).toBeInTheDocument();
    expect(screen.getByText("HuskyMarkets")).toBeInTheDocument();
  });

  it("renders a 6-outcome market's leading label without error (FR-29)", () => {
    render(
      <MarketOgCard
        card={{ ...card, leading: { label: "Green Line", price: 41 } }}
      />,
    );
    expect(screen.getByText("Green Line 41¢")).toBeInTheDocument();
  });

  it("escapes UGC labels — markup in a label renders as text, never HTML", () => {
    const { container } = render(
      <MarketOgCard
        card={{
          ...card,
          title: "Will it snow before finals?",
          leading: { label: '<img src=x onerror="alert(1)">', price: 63 },
        }}
      />,
    );
    expect(
      screen.getByText(/<img src=x onerror="alert\(1\)"> 63¢/),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("BetOgCard", () => {
  const card = {
    marketId: "m1",
    marketTitle: "Will it snow before finals?",
    outcomeLabel: "No",
    priceAtBet: 22,
    stake: 250,
    payout: 396,
    displayName: "QuietHusky42",
  };

  it("renders called-it price, title, stake to payout, outcome label, display name and wordmark", () => {
    render(<BetOgCard card={card} />);
    expect(screen.getByText(/Called it at 22¢/)).toBeInTheDocument();
    expect(screen.getByText("Will it snow before finals?")).toBeInTheDocument();
    expect(screen.getByText(/250 HC/)).toBeInTheDocument();
    expect(screen.getByText(/396 HC/)).toBeInTheDocument();
    expect(screen.getByText(/QuietHusky42/)).toBeInTheDocument();
    expect(screen.getByText(/No · huskymarkets/)).toBeInTheDocument();
    expect(screen.getByText("HuskyMarkets")).toBeInTheDocument();
  });

  it("shows any outcome label, not just Yes/No (FR-29)", () => {
    render(<BetOgCard card={{ ...card, outcomeLabel: "Outtakes" }} />);
    expect(screen.getByText(/Outtakes · huskymarkets/)).toBeInTheDocument();
  });

  it("escapes UGC labels — markup in a label renders as text, never HTML", () => {
    const { container } = render(
      <BetOgCard
        card={{ ...card, outcomeLabel: '<script>alert("x")</script>' }}
      />,
    );
    expect(
      screen.getByText(/<script>alert\("x"\)<\/script>/),
    ).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
