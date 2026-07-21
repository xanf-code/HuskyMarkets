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

  it("shows a visible invite when the session flag is unset", async () => {
    render(<GuestScrollPrompt />);
    expect(
      await screen.findByRole("complementary", {
        name: /sign in to place bets/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you're browsing as a guest/i),
    ).toBeInTheDocument();
  });

  it("stays hidden when the session flag is already set", () => {
    sessionStorage.setItem("hm-guest-prompted", "1");
    render(<GuestScrollPrompt />);
    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the sign-in prompt and dismisses for the session", async () => {
    const user = userEvent.setup();
    render(<GuestScrollPrompt />);

    await user.click(await screen.findByRole("button", { name: /^sign in$/i }));

    expect(promptSignIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
  });

  it("dismisses without prompting on Not now", async () => {
    const user = userEvent.setup();
    render(<GuestScrollPrompt />);

    await user.click(await screen.findByRole("button", { name: /not now/i }));

    expect(promptSignIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
  });

  it("still shows when sessionStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<GuestScrollPrompt />);
    expect(
      await screen.findByRole("complementary", {
        name: /sign in to place bets/i,
      }),
    ).toBeInTheDocument();
  });
});
