import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SignInPromptProvider,
  useSignInPrompt,
} from "./SignInPromptProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/market/abc-123",
}));

function Trigger() {
  const { promptSignIn } = useSignInPrompt();
  return (
    <button type="button" onClick={promptSignIn}>
      gated action
    </button>
  );
}

describe("SignInPromptProvider", () => {
  it("opens the sign-in dialog when a gated control prompts", async () => {
    const user = userEvent.setup();
    render(
      <SignInPromptProvider>
        <Trigger />
      </SignInPromptProvider>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "gated action" }));

    expect(
      screen.getByRole("dialog", { name: /sign in to keep going/i }),
    ).toBeInTheDocument();
  });

  it("links to /login with the current path as the next return path", async () => {
    const user = userEvent.setup();
    render(
      <SignInPromptProvider>
        <Trigger />
      </SignInPromptProvider>,
    );

    await user.click(screen.getByRole("button", { name: "gated action" }));

    expect(
      screen.getByRole("link", { name: /log in with northeastern email/i }),
    ).toHaveAttribute("href", "/login?next=%2Fmarket%2Fabc-123");
  });

  it("closes the dialog when the login link is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SignInPromptProvider>
        <Trigger />
      </SignInPromptProvider>,
    );

    await user.click(screen.getByRole("button", { name: "gated action" }));
    await user.click(
      screen.getByRole("link", { name: /log in with northeastern email/i }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses on close and can be prompted again", async () => {
    const user = userEvent.setup();
    render(
      <SignInPromptProvider>
        <Trigger />
      </SignInPromptProvider>,
    );

    await user.click(screen.getByRole("button", { name: "gated action" }));
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "gated action" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
