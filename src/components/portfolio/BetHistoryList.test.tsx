import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BetHistoryList } from "./BetHistoryList";
import type { BetHistoryRow } from "@/lib/queries/portfolio";

function row(overrides: Partial<BetHistoryRow> = {}): BetHistoryRow {
  return {
    betId: "b-1",
    marketId: "m-1",
    marketTitle: "Will it snow before finals?",
    outcomeLabel: "Yes",
    amount: 100,
    priceAtBet: 50,
    createdAt: "2026-07-10T10:00:00Z",
    marketStatus: "open",
    ...overrides,
  };
}

const MANY = Array.from({ length: 14 }, (_, i) =>
  row({ betId: `b-${i}`, marketTitle: `Market ${i}` }),
);

describe("BetHistoryList", () => {
  it("renders an empty state when no bets", () => {
    render(<BetHistoryList rows={[]} />);
    expect(screen.getByText(/no bets placed/i)).toBeInTheDocument();
  });

  it("renders a link to the market for each row", () => {
    render(<BetHistoryList rows={[row()]} />);
    const link = screen.getByRole("link", { name: /snow before finals/i });
    expect(link).toHaveAttribute("href", "/market/m-1");
  });

  it("shows the outcome label and amount", () => {
    render(<BetHistoryList rows={[row()]} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it("shows first page and loads more on button click", async () => {
    const user = userEvent.setup();
    render(<BetHistoryList rows={MANY} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getAllByRole("listitem")).toHaveLength(14);
  });

  it("loads next page via IntersectionObserver", () => {
    let cb: IntersectionObserverCallback | null = null;
    class MockIO {
      constructor(fn: IntersectionObserverCallback) { cb = fn; }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIO);

    render(<BetHistoryList rows={MANY} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(12);

    act(() => {
      cb?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(14);
  });
});
