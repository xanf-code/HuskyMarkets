import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolveQueueItem } from "@/lib/queries/admin";
import { ResolveQueue } from "./ResolveQueue";

const { resolveMarketAction, lockMarketAction, refresh } = vi.hoisted(() => ({
  resolveMarketAction: vi.fn(),
  lockMarketAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/actions/admin", () => ({ resolveMarketAction, lockMarketAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const item: ResolveQueueItem = {
  id: "m1",
  title: "Which dining hall runs out of chicken first?",
  status: "open",
  closeAt: "2026-07-20T00:00:00Z",
  reportCount: 0,
  autoFlagged: false,
  creatorId: "u1",
  outcomes: [
    { id: "o-a", label: "Stetson West" },
    { id: "o-b", label: "IV" },
    { id: "o-c", label: "Outtakes" },
    { id: "o-d", label: "None of the above" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveMarketAction.mockResolvedValue({ ok: true });
  lockMarketAction.mockResolvedValue({ ok: true });
});

describe("ResolveQueue", () => {
  it("renders one resolve button per outcome plus Void and Lock (FR-28)", () => {
    render(<ResolveQueue items={[item]} />);

    for (const outcome of item.outcomes) {
      expect(
        screen.getByRole("button", { name: outcome.label }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock" })).toBeInTheDocument();
  });

  it("resolves with p_action='resolve' and the chosen winning outcome (REC-10)", async () => {
    const user = userEvent.setup();
    render(<ResolveQueue items={[item]} />);

    await user.click(screen.getByRole("button", { name: "IV" }));

    expect(resolveMarketAction).toHaveBeenCalledWith({
      marketId: "m1",
      action: "resolve",
      winningOutcomeId: "o-b",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("voids with an explicit discriminant, never a null sentinel", async () => {
    const user = userEvent.setup();
    render(<ResolveQueue items={[item]} />);

    await user.click(screen.getByRole("button", { name: "Void" }));

    expect(resolveMarketAction).toHaveBeenCalledWith({
      marketId: "m1",
      action: "void",
    });
  });

  it("locks an open market via the lock action", async () => {
    const user = userEvent.setup();
    render(<ResolveQueue items={[item]} />);

    await user.click(screen.getByRole("button", { name: "Lock" }));

    expect(lockMarketAction).toHaveBeenCalledWith({ marketId: "m1" });
  });

  it("hides Lock for markets that are not open", () => {
    render(<ResolveQueue items={[{ ...item, status: "closed" }]} />);

    expect(
      screen.queryByRole("button", { name: "Lock" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces action errors inline", async () => {
    resolveMarketAction.mockResolvedValue({
      ok: false,
      error: "Only moderators can resolve markets.",
    });
    const user = userEvent.setup();
    render(<ResolveQueue items={[item]} />);

    await user.click(screen.getByRole("button", { name: "Void" }));

    expect(
      await screen.findByText(/only moderators/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state when the queue has no markets", () => {
    render(<ResolveQueue items={[]} />);

    expect(screen.getByText(/resolve queue is empty/i)).toBeInTheDocument();
  });
});
