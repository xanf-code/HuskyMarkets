import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestScrollPrompt } from "./GuestScrollPrompt";

const { promptSignIn } = vi.hoisted(() => ({ promptSignIn: vi.fn() }));

vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

describe("GuestScrollPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders a visible sign-in card for unprompted guests", () => {
    render(<GuestScrollPrompt />);
    expect(
      screen.getByRole("complementary", { name: /sign in to place bets/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/you're browsing as a guest/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument();
  });

  it("does not open a dialog", () => {
    render(<GuestScrollPrompt />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays hidden when the session flag is already set", () => {
    sessionStorage.setItem("hm-guest-prompted", "1");
    render(<GuestScrollPrompt />);

    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the sign-in prompt and dismisses on Sign in click", async () => {
    const user = userEvent.setup();
    render(<GuestScrollPrompt />);

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(promptSignIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
  });

  it("dismisses without prompting on Not now", async () => {
    const user = userEvent.setup();
    render(<GuestScrollPrompt />);

    await user.click(screen.getByRole("button", { name: /not now/i }));

    expect(promptSignIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
  });

  it("still shows when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<GuestScrollPrompt />);

    expect(
      screen.getByRole("complementary", { name: /sign in to place bets/i }),
    ).toBeInTheDocument();
  });
});
