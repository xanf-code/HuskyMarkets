import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("CreateMarketForm frontend validation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an error and blocks the server call when title is fewer than 10 characters", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Too short" }, // 9 chars
    });
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(
      await screen.findByText(/at least 10 characters/i),
    ).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("shows an error and blocks the server call when resolution criteria is fewer than 20 characters", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/how will this resolve/i), {
      target: { value: "Too brief." }, // 10 chars
    });
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(
      await screen.findByText(/at least 20 characters/i),
    ).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("shows an error and blocks the server call when close date is empty", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/closes/i), {
      target: { value: "" },
    });
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(
      await screen.findByText(/close date is required/i),
    ).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("shows an error and blocks the server call when resolve date is before close date", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    fillRequiredFields();
    // close is 2026-07-25 from fillRequiredFields; set resolve one day earlier
    fireEvent.change(screen.getByLabelText(/resolves by/i), {
      target: { value: "2026-07-24T20:00" },
    });
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(
      await screen.findByText(/at or after the close/i),
    ).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("shows an error and blocks the server call when close date is in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
    render(<CreateMarketForm />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/closes/i), {
      target: { value: "2026-07-19T20:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create market/i }));

    expect(screen.getByText(/in the future/i)).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("shows an error and blocks the server call when an outcome label is blank", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await user.clear(screen.getByLabelText("Outcome 1"));
    fillRequiredFields();
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(
      await screen.findByText(/can't be blank/i),
    ).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("shows an error and blocks the server call when outcome labels are duplicates", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    await user.clear(screen.getByLabelText("Outcome 2"));
    await user.type(screen.getByLabelText("Outcome 2"), "Yes");
    fillRequiredFields();
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(await screen.findByText(/must be unique/i)).toBeInTheDocument();
    expect(createMarket).not.toHaveBeenCalled();
  });

  it("clears field errors once the form is corrected and resubmitted", async () => {
    const user = userEvent.setup();
    render(<CreateMarketForm />);

    // Trigger title error
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Short" },
    });
    await user.click(screen.getByRole("button", { name: /create market/i }));
    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();

    // Fix the title and resubmit
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Will the shuttle run on time this Friday?" },
    });
    await user.click(screen.getByRole("button", { name: /create market/i }));

    expect(screen.queryByText(/at least 10 characters/i)).not.toBeInTheDocument();
    expect(createMarket).toHaveBeenCalledTimes(1);
  });

  it("shows required asterisks on title, close, resolve, and resolution criteria labels", () => {
    render(<CreateMarketForm />);

    expect(screen.getByLabelText(/title/i)).toBeRequired();
    expect(screen.getByLabelText(/closes/i)).toBeRequired();
    expect(screen.getByLabelText(/resolves by/i)).toBeRequired();
    expect(screen.getByLabelText(/how will this resolve/i)).toBeRequired();
  });
});
