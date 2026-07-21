import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const { signInWithOtp, searchParams } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  searchParams: { value: "" },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParams.value),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    searchParams.value = "";
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it("rejects a non-NEU email inline without contacting Supabase", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "husky@gmail.com");
    await user.click(screen.getByRole("button", { name: /magic link/i }));

    expect(
      await screen.findByText(/@northeastern\.edu/),
    ).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a magic link to an NEU email via the auth callback", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "husky@northeastern.edu");
    await user.click(screen.getByRole("button", { name: /magic link/i }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "husky@northeastern.edu",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows the Supabase error when the link fails to send", async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: "rate limit exceeded" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "husky@northeastern.edu");
    await user.click(screen.getByRole("button", { name: /magic link/i }));

    expect(await screen.findByText("rate limit exceeded")).toBeInTheDocument();
  });

  it("carries a valid next return path into the auth callback", async () => {
    searchParams.value = "next=%2Fmarket%2Fabc-123";
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "husky@northeastern.edu");
    await user.click(screen.getByRole("button", { name: /magic link/i }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "husky@northeastern.edu",
      options: {
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=%2Fmarket%2Fabc-123",
      },
    });
  });

  it("drops a protocol-relative next path (open-redirect guard)", async () => {
    searchParams.value = "next=%2F%2Fevil.com";
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "husky@northeastern.edu");
    await user.click(screen.getByRole("button", { name: /magic link/i }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "husky@northeastern.edu",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
  });
});
