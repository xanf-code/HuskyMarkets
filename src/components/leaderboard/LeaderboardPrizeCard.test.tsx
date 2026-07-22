import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaderboardPrizeCard } from "./LeaderboardPrizeCard";

describe("LeaderboardPrizeCard", () => {
  it("shows the gift card prize copy", () => {
    render(<LeaderboardPrizeCard />);

    expect(
      screen.getByText(/\$150 Campus Store gift card/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/#1 on the Fall 2026 semester leaderboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/Top the board/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/claim the prize/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dismiss/i }),
    ).not.toBeInTheDocument();
  });
});
