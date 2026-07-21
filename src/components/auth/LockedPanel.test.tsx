import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LockedPanel } from "./LockedPanel";

const { promptSignIn } = vi.hoisted(() => ({ promptSignIn: vi.fn() }));

vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

describe("LockedPanel", () => {
  it("renders placeholder rows that are hidden from assistive tech", () => {
    const { container } = render(<LockedPanel variant="activity" />);

    const rows = container.querySelector('[aria-hidden="true"]');
    expect(rows).toBeInTheDocument();
    expect(rows?.className).toContain("blur-[2px]");
  });

  it("prompts sign-in from the overlay button", async () => {
    const user = userEvent.setup();
    render(<LockedPanel variant="activity" />);

    await user.click(screen.getByRole("button", { name: /sign in to view/i }));

    expect(promptSignIn).toHaveBeenCalledTimes(1);
  });

  it("uses leaderboard copy for the leaderboard variant", () => {
    render(<LockedPanel variant="leaderboard" />);

    expect(
      screen.getByText(/the leaderboard is for members/i),
    ).toBeInTheDocument();
  });
});
