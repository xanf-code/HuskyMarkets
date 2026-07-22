import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIRST_RUN_KEY } from "@/lib/onboarding-flags";
import { FirstRunBanner } from "./FirstRunBanner";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("FirstRunBanner", () => {
  it("stays hidden when first-run is not pending", () => {
    render(<FirstRunBanner />);
    expect(screen.queryByText(/place a take/i)).not.toBeInTheDocument();
  });

  it("shows for a pending first-run and dismisses permanently", async () => {
    localStorage.setItem(FIRST_RUN_KEY, "1");
    const user = userEvent.setup();
    render(<FirstRunBanner />);

    expect(await screen.findByText(/place a take/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /got it/i }));

    expect(screen.queryByText(/place a take/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBeNull();
  });
});
