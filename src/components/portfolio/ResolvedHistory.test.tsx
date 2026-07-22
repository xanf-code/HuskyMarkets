import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ResolvedHistory } from "./ResolvedHistory";
import type { ResolvedPosition } from "@/lib/queries/portfolio";

function row(overrides: Partial<ResolvedPosition>): ResolvedPosition {
  return {
    marketId: "m1",
    marketTitle: "Snow before finals?",
    outcomeLabel: "Yes",
    stake: 100,
    payout: 158,
    estimatedPayout: 200,
    pnl: 58,
    won: true,
    resolvedAt: "2026-07-02T12:00:00Z",
    shareBetId: "b-best",
    ...overrides,
  };
}

function renderHistory(rows: ResolvedPosition[]) {
  return render(
    <ToastProvider>
      <ResolvedHistory rows={rows} />
    </ToastProvider>,
  );
}

describe("ResolvedHistory", () => {
  it("offers copy + view actions for a winning share card", () => {
    renderHistory([row({})]);
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view card/i })).toHaveAttribute(
      "href",
      "/share/bet/b-best",
    );
  });

  it("hides share actions for lost positions", () => {
    renderHistory([
      row({
        won: false,
        shareBetId: null,
        outcomeLabel: "No",
        payout: 0,
        pnl: -100,
        estimatedPayout: null,
      }),
    ]);
    expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /view card/i })).toBeNull();
  });

  it("shows the bet-time estimate next to the actual payout (FR-21, FR-24)", () => {
    renderHistory([row({})]);
    expect(screen.getByText(/Est\. payout/)).toBeInTheDocument();
    expect(screen.getByLabelText("200 HC")).toBeInTheDocument();
  });

  it("omits the estimate for lost positions", () => {
    renderHistory([
      row({
        won: false,
        shareBetId: null,
        payout: 0,
        pnl: -100,
        estimatedPayout: null,
      }),
    ]);
    expect(screen.queryByText(/Est\. payout/)).toBeNull();
  });
});
