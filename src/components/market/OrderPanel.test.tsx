import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { OrderPanel } from "./OrderPanel";

const { placeBet } = vi.hoisted(() => ({ placeBet: vi.fn() }));

vi.mock("@/actions/bets", () => ({ placeBet }));

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    marketId: "m1",
    status: "open" as const,
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    yesPool: 200,
    noPool: 100,
    position: { yes: 100, no: 0 },
    balance: 400,
    ...overrides,
  };
  return render(
    <ToastProvider>
      <OrderPanel {...props} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  placeBet.mockResolvedValue({
    ok: true,
    betId: "b1",
    yesPool: 300,
    noPool: 100,
    impliedYes: 75,
    newBalance: 300,
  });
});

describe("OrderPanel", () => {
  it("shows both prices and defaults to YES", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /YES 67¢/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /NO 33¢/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("estimates the payout live, mirroring the SQL math", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/stake/i), "100");

    // total 400, vig 20, after 380 → floor(100·380/300) = 126
    expect(screen.getByText(/est\. 126 HC if YES/)).toBeInTheDocument();
  });

  it("quick-fills amounts, with Max capped by cap remaining and balance", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "50" }));
    expect(screen.getByLabelText(/stake/i)).toHaveValue(50);

    // cap remaining 400 (100 already staked), balance 400 → Max = 400
    await user.click(screen.getByRole("button", { name: "Max" }));
    expect(screen.getByLabelText(/stake/i)).toHaveValue(400);
  });

  it("submits the bet and applies the fill optimistically", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/stake/i), "100");
    await user.click(screen.getByRole("button", { name: /place bet/i }));

    expect(placeBet).toHaveBeenCalledWith({
      marketId: "m1",
      side: "yes",
      amount: 100,
    });
    // fill moves the displayed price to the RPC's post-bet 75¢
    expect(
      await screen.findByRole("button", { name: /YES 75¢/ }),
    ).toBeInTheDocument();
  });

  it("surfaces action errors inline", async () => {
    placeBet.mockResolvedValue({
      ok: false,
      error: "You don't have enough HC for that bet.",
    });
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/stake/i), "100");
    await user.click(screen.getByRole("button", { name: /place bet/i }));

    expect(
      await screen.findByText(/enough HC for that bet/),
    ).toBeInTheDocument();
  });

  it("disables betting on closed markets", () => {
    renderPanel({ status: "closed" });
    expect(screen.getByRole("button", { name: /closed/i })).toBeDisabled();
  });

  it("disables the submit when the stake exceeds the balance", async () => {
    const user = userEvent.setup();
    renderPanel({ balance: 30 });

    await user.type(screen.getByLabelText(/stake/i), "100");

    expect(screen.getByRole("button", { name: /place bet/i })).toBeDisabled();
  });
});
