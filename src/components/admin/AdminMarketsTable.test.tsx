import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMarketRow } from "@/lib/queries/admin";
import { AdminMarketsTable } from "./AdminMarketsTable";

const { setMarketHidden, refresh } = vi.hoisted(() => ({
  setMarketHidden: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/actions/admin", () => ({ setMarketHidden }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const makeMarket = (overrides: Partial<AdminMarketRow> = {}): AdminMarketRow => ({
  id: "m1",
  title: "Will the MBTA Green Line run on time on Friday?",
  status: "open",
  hidden: false,
  autoFlagged: false,
  closeAt: "2027-01-01T00:00:00Z",
  createdAt: "2026-07-01T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  setMarketHidden.mockResolvedValue({ ok: true });
});

describe("AdminMarketsTable", () => {
  it("renders all markets when no query is entered", () => {
    const markets = [
      makeMarket({ id: "m1", title: "Will the Green Line run on time?" }),
      makeMarket({ id: "m2", title: "Will Curry close for renovations?" }),
    ];
    render(<AdminMarketsTable markets={markets} />);

    expect(screen.getByText("Will the Green Line run on time?")).toBeInTheDocument();
    expect(screen.getByText("Will Curry close for renovations?")).toBeInTheDocument();
  });

  it("filters markets by title as the user types", async () => {
    const user = userEvent.setup();
    const markets = [
      makeMarket({ id: "m1", title: "Will the Green Line run on time?" }),
      makeMarket({ id: "m2", title: "Will Curry close for renovations?" }),
    ];
    render(<AdminMarketsTable markets={markets} />);

    await user.type(screen.getByPlaceholderText(/search markets/i), "Green");

    expect(screen.getByText("Will the Green Line run on time?")).toBeInTheDocument();
    expect(screen.queryByText("Will Curry close for renovations?")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<AdminMarketsTable markets={[makeMarket()]} />);

    await user.type(screen.getByPlaceholderText(/search markets/i), "mbta green line");

    expect(screen.getByText("Will the MBTA Green Line run on time on Friday?")).toBeInTheDocument();
  });

  it("shows no-match empty state when query has no results", async () => {
    const user = userEvent.setup();
    render(<AdminMarketsTable markets={[makeMarket()]} />);

    await user.type(screen.getByPlaceholderText(/search markets/i), "xyzzy");

    expect(screen.getByText(/no markets match/i)).toBeInTheDocument();
    expect(screen.queryByText("Will the MBTA Green Line run on time on Friday?")).not.toBeInTheDocument();
  });

  it("shows all markets again after clearing the search", async () => {
    const user = userEvent.setup();
    render(<AdminMarketsTable markets={[makeMarket()]} />);

    const input = screen.getByPlaceholderText(/search markets/i);
    await user.type(input, "xyzzy");
    await user.clear(input);

    expect(screen.getByText("Will the MBTA Green Line run on time on Friday?")).toBeInTheDocument();
  });

  it("shows empty state when there are no markets at all", () => {
    render(<AdminMarketsTable markets={[]} />);

    expect(screen.getByText(/no markets to manage/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search markets/i)).not.toBeInTheDocument();
  });

  it("shows hidden and auto-flagged badges in the status line", () => {
    render(
      <AdminMarketsTable
        markets={[makeMarket({ hidden: true, autoFlagged: true })]}
      />,
    );

    expect(screen.getByText(/hidden/)).toBeInTheDocument();
    expect(screen.getByText(/auto-flagged/)).toBeInTheDocument();
  });

  it("calls setMarketHidden with hidden=true when Hide is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminMarketsTable markets={[makeMarket()]} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(setMarketHidden).toHaveBeenCalledWith({ marketId: "m1", hidden: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("calls setMarketHidden with hidden=false when Unhide is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminMarketsTable markets={[makeMarket({ hidden: true })]} />);

    await user.click(screen.getByRole("button", { name: "Unhide" }));

    expect(setMarketHidden).toHaveBeenCalledWith({ marketId: "m1", hidden: false });
  });

  it("surfaces action errors inline", async () => {
    setMarketHidden.mockResolvedValue({ ok: false, error: "Admin only." });
    const user = userEvent.setup();
    render(<AdminMarketsTable markets={[makeMarket()]} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(await screen.findByText(/admin only/i)).toBeInTheDocument();
  });
});
