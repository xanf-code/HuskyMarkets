import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateMarketForm } from "./CreateMarketForm";

const { createMarket, push } = vi.hoisted(() => ({
  createMarket: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/actions/markets", () => ({ createMarket }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/title/i), {
    target: { value: "Will the shuttle run on Saturday?" },
  });
  fireEvent.change(screen.getByLabelText(/closes/i), {
    target: { value: "2026-07-25T20:00" },
  });
  fireEvent.change(screen.getByLabelText(/resolves by/i), {
    target: { value: "2026-07-26T20:00" },
  });
  fireEvent.change(screen.getByLabelText(/how will this resolve/i), {
    target: {
      value: "Resolves to the matching outcome per the official tracker feed.",
    },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /content rule/i }));
}

async function addOutcomes(user: ReturnType<typeof userEvent.setup>, n: number) {
  for (let i = 0; i < n; i++) {
    await user.click(screen.getByRole("button", { name: /add outcome/i }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  createMarket.mockResolvedValue({ ok: true, marketId: "m1" });
});

describe("CreateMarketForm outcomes", () => {
  it("starts with the binary default: two editable outcome inputs", () => {
    render(<CreateMarketForm />);

    expect(screen.getByLabelText("Outcome 1")).toHaveValue("Yes");
    expect(screen.getByLabelText("Outcome 2")).toHaveValue("No");
    expect(
      screen.getByRole("button", { name: /add outcome/i }),
    ).toBeEnabled();
  });

  it("disables removal at the 2-outcome minimum (C-2)", () => {
    render(<CreateMarketForm />);

    expect(
      screen.getByRole("button", { name: "Remove outcome 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove outcome 2" }),
    ).toBeDisabled();
  });

  it("adds an outcome below the max and allows removing it again", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await addOutcomes(user, 1);
    expect(screen.getByLabelText("Outcome 3")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Remove outcome 3" }));
    expect(screen.queryByLabelText("Outcome 3")).not.toBeInTheDocument();
  });

  it("disables Add at the 6-outcome maximum (C-1)", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await addOutcomes(user, 4);

    expect(screen.getByLabelText("Outcome 6")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add outcome/i }),
    ).toBeDisabled();
  });

  it("appends the catch-all as a read-only final outcome that counts within 6 (FR-3)", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await user.click(
      screen.getByRole("checkbox", { name: /none of the above/i }),
    );

    const catchAll = screen.getByLabelText("Catch-all outcome");
    expect(catchAll).toHaveValue("None of the above");
    expect(catchAll).toHaveAttribute("readOnly");

    // 5 creator labels + catch-all = 6 max
    await addOutcomes(user, 3);
    expect(screen.getByLabelText("Outcome 5")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add outcome/i }),
    ).toBeDisabled();
  });

  it("blocks the catch-all toggle when 6 labels already fill the market", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await addOutcomes(user, 4);

    expect(
      screen.getByRole("checkbox", { name: /none of the above/i }),
    ).toBeDisabled();
  });

  it("rejects a creator label that collides with the catch-all inline", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await user.clear(screen.getByLabelText("Outcome 1"));
    await user.type(screen.getByLabelText("Outcome 1"), "none of the above");
    await user.click(
      screen.getByRole("checkbox", { name: /none of the above/i }),
    );

    fillRequiredFields();
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(
      await screen.findByText(/added by the catch-all toggle/i),
    ).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("submits the dynamic outcome list and catch-all flag", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await addOutcomes(user, 1);
    await user.type(screen.getByLabelText("Outcome 3"), "Maybe");
    await user.click(
      screen.getByRole("checkbox", { name: /none of the above/i }),
    );

    fillRequiredFields();
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(createMarket).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomes: ["Yes", "No", "Maybe"],
        catchAll: true,
      }),
    );
  });

  it("uses outcome-neutral resolution copy, not YES/NO phrasing (FR-27)", () => {
    render(<CreateMarketForm />);

    const criteria = screen.getByLabelText(/how will this resolve/i);
    expect(criteria.getAttribute("placeholder") ?? "").not.toMatch(
      /resolves yes/i,
    );
  });

  it("disables Add at the configured max when maxOutcomes=3 (W1)", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm maxOutcomes={3} />);

    await addOutcomes(user, 1);

    expect(screen.getByLabelText("Outcome 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add outcome/i }),
    ).toBeDisabled();
  });
});
