import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { OutcomeState } from "@/lib/outcomes";
import { OrderPanel } from "./OrderPanel";

const { placeBet, promptSignIn } = vi.hoisted(() => ({
  placeBet: vi.fn(),
  promptSignIn: vi.fn(),
}));

vi.mock("@/actions/bets", () => ({ placeBet }));
vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

const YES: OutcomeState = { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 };
const NO: OutcomeState = { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 };

const FILLED: OutcomeState[] = [
  { ...YES, pool: 300, implied: 75 },
  { ...NO, implied: 25 },
];

function renderPanel(overrides: Record<string, unknown> = {}) {
  const props = {
    marketId: "m1",
    status: "open" as const,
    closeAt: new Date(Date.now() + 86_400_000).toISOString(),
    outcomes: [YES, NO],
    position: [{ outcomeId: "o-yes", label: "Yes", stake: 100 }],
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
    outcomes: FILLED,
    newBalance: 300,
  });
});

describe("OrderPanel", () => {
  it("renders the market question as a context line when provided", () => {
    renderPanel({ question: "Will the Huskies win on Saturday?" });
    expect(
      screen.getByText("Will the Huskies win on Saturday?"),
    ).toBeInTheDocument();
  });

  it("shows every outcome with its price and defaults to the first in sort_order", () => {
    renderPanel();
    const yes = screen.getByRole("button", { name: /Yes 67%/ });
    const no = screen.getByRole("button", { name: /No 33%/ });
    expect(yes).toHaveAttribute("aria-pressed", "true");
    expect(no).toHaveAttribute("aria-pressed", "false");
  });

  it("labels the submit with the selected outcome and price", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /Buy Yes · 67%/i }),
    ).toBeInTheDocument();
  });

  it("shows the odds as an implied chance for the selected outcome", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.getByText("67% chance")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /No 33%/ }));
    expect(screen.getByText("33% chance")).toBeInTheDocument();
  });

  it("shows the est. payout live, mirroring the SQL math", async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();

    await user.type(screen.getByLabelText(/amount/i), "100");

    // total 400, vig 20, after 380 → floor(100·380/300) = 126
    expect(screen.getByLabelText("126 HC")).toBeInTheDocument();
    expect(screen.getByText(/Est\. payout/)).toBeInTheDocument();
    // Generic arrow glyphs are banned from the UI.
    expect(container.textContent).not.toContain("→");
  });

  it("quick-fills amounts, with Max capped by cap remaining and balance", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "50" }));
    expect(screen.getByLabelText(/amount/i)).toHaveValue(50);

    // cap remaining 400 (100 already staked), balance 400 → Max = 400
    await user.click(screen.getByRole("button", { name: "Max" }));
    expect(screen.getByLabelText(/amount/i)).toHaveValue(400);
  });

  it("submits the bet against the selected outcome and applies the fill optimistically", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/amount/i), "100");
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67%/i }));

    expect(placeBet).toHaveBeenCalledWith({
      marketId: "m1",
      outcomeId: "o-yes",
      amount: 100,
    });
    // fill moves the displayed price to the RPC's post-bet 75%
    expect(
      await screen.findByRole("button", { name: /Yes 75%/ }),
    ).toBeInTheDocument();
  });

  it("surfaces action errors inline", async () => {
    placeBet.mockResolvedValue({
      ok: false,
      error: "You don't have enough HC for that bet.",
    });
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/amount/i), "100");
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67%/i }));

    expect(
      await screen.findByText(/enough HC for that bet/),
    ).toBeInTheDocument();
  });

  it("syncs prices when live outcome props arrive", () => {
    const { rerender } = renderPanel();
    expect(screen.getByRole("button", { name: /Yes 67%/ })).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <OrderPanel
          marketId="m1"
          status="open"
          closeAt={new Date(Date.now() + 86_400_000).toISOString()}
          outcomes={[
            { ...YES, pool: 100, implied: 25 },
            { ...NO, pool: 300, implied: 75 },
          ]}
          position={[{ outcomeId: "o-yes", label: "Yes", stake: 100 }]}
          balance={400}
        />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: /Yes 25%/ })).toBeInTheDocument();
  });

  it("reports successful fills so live consumers update optimistically", async () => {
    const onFill = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onFill });

    await user.type(screen.getByLabelText(/amount/i), "100");
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67%/i }));

    await screen.findByRole("button", { name: /Yes 75%/ });
    expect(onFill).toHaveBeenCalledWith({ outcomes: FILLED });
  });

  it("disables betting on closed markets", () => {
    renderPanel({ status: "closed" });
    expect(screen.getByRole("button", { name: /closed/i })).toBeDisabled();
  });

  it("disables the submit when the stake exceeds the balance", async () => {
    const user = userEvent.setup();
    renderPanel({ balance: 30 });

    await user.type(screen.getByLabelText(/amount/i), "100");

    expect(screen.getByRole("button", { name: /Buy Yes · 67%/i })).toBeDisabled();
  });

  it("renders every outcome of a 6-outcome market as a selectable button", () => {
    const six: OutcomeState[] = Array.from({ length: 6 }, (_, i) => ({
      id: `o-${i}`,
      label: `Outcome ${i + 1}`,
      sortOrder: i,
      pool: 100,
      implied: 17,
    }));
    renderPanel({ outcomes: six, position: [] });

    for (const outcome of six) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`${outcome.label} 17%`),
        }),
      ).toBeInTheDocument();
    }
  });

  it("defaults to the first sort_order outcome when all pools are equal", () => {
    renderPanel({
      outcomes: [
        { ...YES, pool: 100, implied: 50 },
        { ...NO, pool: 100, implied: 50 },
      ],
      position: [],
    });

    expect(screen.getByRole("button", { name: /Yes 50%/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("recomputes the est. payout from the library when the outcome changes", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/amount/i), "100");
    // Yes selected: floor(100·380/300) = 126
    expect(screen.getByLabelText("126 HC")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /No 33%/ }));
    // No selected: floor(100·380/200) = 190
    expect(screen.getByLabelText("190 HC")).toBeInTheDocument();
  });

  it("repeats the est. payout at the moment of purchase in the fill toast", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(/amount/i), "100");
    await user.click(screen.getByRole("button", { name: /Buy Yes · 67%/i }));

    expect(await screen.findByText(/est\. 126 HC/i, { exact: false })).toBeInTheDocument();
  });

  describe("guest mode", () => {
    it("prompts sign-in instead of selecting an outcome", async () => {
      const user = userEvent.setup();
      renderPanel({ guest: true, balance: 0, position: [] });

      await user.click(screen.getByRole("button", { name: /No 33%/ }));

      expect(promptSignIn).toHaveBeenCalledTimes(1);
      // Selection unchanged: Yes stays the pressed outcome.
      expect(screen.getByRole("button", { name: /Yes 67%/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("keeps the amount input read-only and prompts on focus", async () => {
      const user = userEvent.setup();
      renderPanel({ guest: true, balance: 0, position: [] });

      const input = screen.getByLabelText(/amount/i);
      expect(input).toHaveAttribute("readonly");

      await user.click(input);

      expect(promptSignIn).toHaveBeenCalled();
      expect(input).not.toHaveFocus();
    });

    it("prompts sign-in from quick amounts and Max without filling the input", async () => {
      const user = userEvent.setup();
      renderPanel({ guest: true, balance: 0, position: [] });

      await user.click(screen.getByRole("button", { name: "50" }));
      await user.click(screen.getByRole("button", { name: "Max" }));

      expect(promptSignIn).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText(/amount/i)).toHaveValue(null);
    });

    it("keeps the Buy button enabled but prompts instead of placing a bet", async () => {
      const user = userEvent.setup();
      renderPanel({ guest: true, balance: 0, position: [] });

      const buy = screen.getByRole("button", { name: /Buy Yes · 67%/i });
      expect(buy).toBeEnabled();

      await user.click(buy);

      expect(promptSignIn).toHaveBeenCalledTimes(1);
      expect(placeBet).not.toHaveBeenCalled();
    });

    it("hides balance and cap rows behind a dash rather than a fake zero", () => {
      renderPanel({ guest: true, balance: 0, position: [] });

      const balanceRow = screen.getByText("Balance").parentElement!;
      expect(balanceRow.textContent).toContain("—");
      expect(balanceRow.textContent).not.toContain("0 HC");

      const capRow = screen.getByText("Cap remaining").parentElement!;
      expect(capRow.textContent).toContain("—");
    });
  });
});
