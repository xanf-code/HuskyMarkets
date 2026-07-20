import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

function stubIntersectionObserver() {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn();
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

function bet(id: string, name: string) {
  return {
    id,
    displayName: name,
    outcomeId: "o-yes",
    outcomeLabel: "Yes",
    amount: 50,
    price: 61,
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  };
}

describe("ActivityFeed", () => {
  beforeEach(stubIntersectionObserver);
  afterEach(() => vi.unstubAllGlobals());

  it("renders a Kalshi-style line per bet", () => {
    render(<ActivityFeed activity={[bet("b1", "HungryHusky42")]} />);
    const line = screen.getByRole("listitem");
    expect(line).toHaveTextContent("HungryHusky42");
    expect(line).toHaveTextContent("50 HC");
    expect(line).toHaveTextContent("Yes");
    expect(line).toHaveTextContent("61¢");
    expect(line).toHaveTextContent("2m ago");
  });

  it("shows a plain empty state when there are no bets", () => {
    render(<ActivityFeed activity={[]} />);
    expect(screen.getByText(/no bets yet/i)).toBeInTheDocument();
  });

  it("windows long feeds behind a scroll sentinel", () => {
    const activity = Array.from({ length: 25 }, (_, i) =>
      bet(`b${i}`, `Husky${i}`),
    );
    render(<ActivityFeed activity={activity} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("status")).toHaveTextContent("15 more");
  });
});
