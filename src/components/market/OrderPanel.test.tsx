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
  it("shows both prices and defaults to Yes with market-semantic styles", () => {
    renderPanel();
    const yes = screen.getByRole("button", { name: /Yes 67¢/ });
    const no = screen.getByRole("button", { name: /No 33¢/ });
    expect(yes).toHaveAttribute("aria-pressed", "true");
    expect(no).toHaveAttribute("aria-pressed", "false");
    expect(yes.className).toMatch(/market-yes/);
    expect(no.className).toMatch(/market-no/);
    expect(yes.className).not.toMatch(/bg-red/);
  });

  it("labels the submit with the selected side and price", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /Buy Yes · 67¢/i }),
    ).toBeInTheDocument();
  });

  it("estimates the payout live, mirroring the SQL math", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/stake/i), "100");

    // total 400, vig 20, after 380 → floor(100·380/300) = 126
    expect(screen.getByText(/est\. 126 HC if Yes/)).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67¢/i }));

    expect(placeBet).toHaveBeenCalledWith({
      marketId: "m1",
      side: "yes",
      amount: 100,
    });
    // fill moves the displayed price to the RPC's post-bet 75¢
    expect(
      await screen.findByRole("button", { name: /Yes 75¢/ }),
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
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67¢/i }));

    expect(
      await screen.findByText(/enough HC for that bet/),
    ).toBeInTheDocument();
  });

  it("syncs prices when live pool props arrive", () => {
    const { rerender } = renderPanel();
    expect(screen.getByRole("button", { name: /Yes 67¢/ })).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <OrderPanel
          marketId="m1"
          status="open"
          closeAt={new Date(Date.now() + 86_400_000).toISOString()}
          yesPool={100}
          noPool={300}
          position={{ yes: 100, no: 0 }}
          balance={400}
        />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: /Yes 25¢/ })).toBeInTheDocument();
  });

  it("reports successful fills so live consumers update optimistically", async () => {
    const onFill = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onFill });

    await user.type(screen.getByLabelText(/stake/i), "100");
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67¢/i }));

    await screen.findByRole("button", { name: /Yes 75¢/ });
    expect(onFill).toHaveBeenCalledWith({ yesPool: 300, noPool: 100 });
  });

  it("disables betting on closed markets", () => {
    renderPanel({ status: "closed" });
    expect(screen.getByRole("button", { name: /closed/i })).toBeDisabled();
  });

  it("disables the submit when the stake exceeds the balance", async () => {
    const user = userEvent.setup();
    renderPanel({ balance: 30 });

    await user.type(screen.getByLabelText(/stake/i), "100");

    expect(screen.getByRole("button", { name: /Buy Yes · 67¢/i })).toBeDisabled();
  });

  it("honors an initial side from the deep link", () => {
    renderPanel({ initialSide: "no" });
    expect(screen.getByRole("button", { name: /No 33¢/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Buy No · 33¢/i }),
    ).toBeInTheDocument();
  });
});
