import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROMO_FALL_2026_KEY,
  dismissPromoBanner,
} from "@/lib/onboarding-flags";
import { LeaderboardPrizeCard } from "./LeaderboardPrizeCard";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("LeaderboardPrizeCard", () => {
  it("shows the gift card prize copy", () => {
    render(<LeaderboardPrizeCard />);

    expect(
      screen.getByText(/\$150 Campus Store gift card/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/#1 on the Fall 2026 semester leaderboard/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Top the board/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/claim the prize/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dismiss/i }),
    ).not.toBeInTheDocument();
  });

  it("stays hidden for guests while the promo banner is showing", () => {
    render(<LeaderboardPrizeCard onlyAfterPromoDismissed />);
    expect(
      screen.queryByLabelText(/semester prize/i),
    ).not.toBeInTheDocument();
  });

  it("appears for guests once the promo banner is dismissed", async () => {
    localStorage.setItem(PROMO_FALL_2026_KEY, "1");
    render(<LeaderboardPrizeCard onlyAfterPromoDismissed />);
    expect(
      await screen.findByLabelText(/semester prize/i),
    ).toBeInTheDocument();
  });

  it("reveals immediately when the promo banner is dismissed in-session", async () => {
    render(<LeaderboardPrizeCard onlyAfterPromoDismissed />);
    expect(
      screen.queryByLabelText(/semester prize/i),
    ).not.toBeInTheDocument();

    dismissPromoBanner();

    await waitFor(() => {
      expect(screen.getByLabelText(/semester prize/i)).toBeInTheDocument();
    });
  });
});
