import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PositionsTable } from "./PositionsTable";

vi.mock("@/components/market/Countdown", () => ({
  Countdown: ({ closeAt }: { closeAt: string }) => (
    <span data-testid="countdown">{closeAt}</span>
  ),
}));

describe("PositionsTable", () => {
  it("renders stake, avg price, and implied value for an open position", () => {
    render(
      <PositionsTable
        positions={[
          {
            marketId: "m1",
            marketTitle: "Green Line delay?",
            side: "yes",
            stake: 150,
            avgPrice: 55,
            impliedValue: 237,
            closeAt: "2026-07-20T20:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Green Line delay?")).toBeInTheDocument();
    expect(screen.getByText("150 HC")).toBeInTheDocument();
    expect(screen.getByText("55¢")).toBeInTheDocument();
    expect(screen.getByText("237 HC")).toBeInTheDocument();
  });

  it("shows a plain empty state when there are no positions", () => {
    render(<PositionsTable positions={[]} />);
    expect(screen.getByText(/no open positions/i)).toBeInTheDocument();
  });
});
