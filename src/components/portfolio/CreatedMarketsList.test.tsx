import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CreatedMarketsList } from "./CreatedMarketsList";
import type { CreatedMarket } from "@/lib/queries/portfolio";

function market(overrides: Partial<CreatedMarket> = {}): CreatedMarket {
  return {
    id: "m-1",
    title: "Will the Green Line run on time?",
    status: "open",
    category: "transit",
    createdAt: "2026-07-10T10:00:00Z",
    closeAt: "2026-07-20T20:00:00Z",
    ...overrides,
  };
}

const MANY = Array.from({ length: 14 }, (_, i) =>
  market({ id: `m-${i}`, title: `Market ${i}` }),
);

describe("CreatedMarketsList", () => {
  it("renders an empty state when no markets", () => {
    render(<CreatedMarketsList markets={[]} />);
    expect(screen.getByText(/no markets created/i)).toBeInTheDocument();
  });

  it("renders a link for each visible market", () => {
    render(<CreatedMarketsList markets={[market()]} />);
    const link = screen.getByRole("link", { name: /green line/i });
    expect(link).toHaveAttribute("href", "/market/m-1");
  });

  it("shows the market status badge", () => {
    render(<CreatedMarketsList markets={[market({ status: "closed" })]} />);
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
  });

  it("shows first page and loads more on button click", async () => {
    const user = userEvent.setup();
    render(<CreatedMarketsList markets={MANY} />);

    // First 12 visible (LIST_PAGE_SIZE = 12)
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(screen.getAllByRole("listitem")).toHaveLength(14);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows the infinite scroll sentinel when hasMore is true", () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    class MockIO {
      constructor(cb: IntersectionObserverCallback) { observerCallback = cb; }
      observe = observe;
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIO);

    render(<CreatedMarketsList markets={MANY} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(12);

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(14);
  });
});
