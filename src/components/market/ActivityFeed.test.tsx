import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

function bet(id: string, outcomeLabel = "Yes") {
  return {
    id,
    outcomeId: "o-yes",
    outcomeLabel,
    amount: 50,
    price: 61,
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  };
}

describe("ActivityFeed", () => {
  it("renders an anonymous Bought line per bet", () => {
    render(<ActivityFeed activity={[bet("b1", "Gavin Newsom")]} />);
    const line = screen.getByRole("listitem");
    expect(line).toHaveTextContent("Bought");
    expect(line).toHaveTextContent("Gavin Newsom");
    expect(line).toHaveTextContent("50");
    expect(line).toHaveTextContent("61%");
    expect(line).toHaveTextContent("2m ago");
    expect(line).not.toHaveTextContent(/Husky/i);
  });

  it("shows an empty state when there are no bets", () => {
    render(<ActivityFeed activity={[]} />);
    expect(screen.getByText(/no bets yet/i)).toBeInTheDocument();
  });

  it("renders every activity item it receives", () => {
    const activity = Array.from({ length: 15 }, (_, i) => bet(`b${i}`));
    render(<ActivityFeed activity={activity} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(15);
  });
});
