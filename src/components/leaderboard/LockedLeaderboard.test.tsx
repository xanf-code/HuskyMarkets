import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LockedLeaderboard } from "./LockedLeaderboard";

const { promptSignIn } = vi.hoisted(() => ({ promptSignIn: vi.fn() }));

vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

describe("LockedLeaderboard", () => {
  it("auto-opens the sign-in prompt on mount", () => {
    render(<LockedLeaderboard />);

    expect(promptSignIn).toHaveBeenCalled();
  });

  it("keeps the fade-locked placeholder rows behind the dialog", () => {
    render(<LockedLeaderboard />);

    expect(
      screen.getByRole("button", { name: /sign in to view/i }),
    ).toBeInTheDocument();
  });
});
