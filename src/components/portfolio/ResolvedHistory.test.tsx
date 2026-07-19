import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResolvedHistory } from "./ResolvedHistory";
import type { ResolvedPosition } from "@/lib/queries/portfolio";

function row(overrides: Partial<ResolvedPosition>): ResolvedPosition {
  return {
    marketId: "m1",
    marketTitle: "Snow before finals?",
    side: "yes",
    outcome: "yes",
    stake: 100,
    payout: 158,
    pnl: 58,
    won: true,
    resolvedAt: "2026-07-02T12:00:00Z",
    shareBetId: "b-best",
    ...overrides,
  };
}

describe("ResolvedHistory", () => {
  it("links won positions to the bet share page", () => {
    render(<ResolvedHistory rows={[row({})]} />);
    expect(screen.getByRole("link", { name: /share/i })).toHaveAttribute(
      "href",
      "/share/bet/b-best",
    );
  });

  it("hides the share link for lost positions", () => {
    render(
      <ResolvedHistory
        rows={[
          row({ won: false, shareBetId: null, outcome: "no", side: "yes", payout: 0, pnl: -100 }),
        ]}
      />,
    );
    expect(screen.queryByRole("link", { name: /share/i })).toBeNull();
  });
});
