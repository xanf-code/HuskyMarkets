import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

describe("ActivityFeed", () => {
  it("renders a Kalshi-style line per bet", () => {
    render(
      <ActivityFeed
        activity={[
          {
            id: "b1",
            displayName: "HungryHusky42",
            side: "yes",
            amount: 50,
            price: 61,
            createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
          },
        ]}
      />,
    );
    const line = screen.getByRole("listitem");
    expect(line).toHaveTextContent("HungryHusky42");
    expect(line).toHaveTextContent("50 HC");
    expect(line).toHaveTextContent("YES");
    expect(line).toHaveTextContent("61¢");
    expect(line).toHaveTextContent("2m ago");
  });

  it("shows a flat empty state when there are no bets", () => {
    render(<ActivityFeed activity={[]} />);
    expect(screen.getByText(/no bets yet/i)).toBeInTheDocument();
  });
});
