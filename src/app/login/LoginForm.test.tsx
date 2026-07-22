import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const { signInWithOtp, verifyOtp, searchParams, routerPush, routerRefresh } = vi.hoisted(
  () => ({
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    searchParams: { value: "" },
    routerPush: vi.fn(),
    routerRefresh: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp, verifyOtp },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParams.value),
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

async function fillAndSendEmail(
  user: ReturnType<typeof userEvent.setup>,
  email = "husky@northeastern.edu",
) {
  await user.type(screen.getByLabelText(/northeastern email/i), email);
  await user.click(screen.getByRole("button", { name: /send code/i }));
}

async function goToVerifyStep(user: ReturnType<typeof userEvent.setup>) {
  render(<LoginForm />);
  await fillAndSendEmail(user);
  await screen.findByLabelText(/6-digit code/i);
}

describe("LoginForm — email step", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    searchParams.value = "";
    signInWithOtp.mockReset();
    verifyOtp.mockReset();
    routerPush.mockReset();
    routerRefresh.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("rejects a non-NEU email inline without contacting Supabase", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSendEmail(user, "husky@gmail.com");

    expect(await screen.findByText(/@northeastern\.edu/)).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("calls signInWithOtp with the email only — no redirect URL", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSendEmail(user);

    expect(signInWithOtp).toHaveBeenCalledWith({ email: "husky@northeastern.edu" });
  });

  it("advances to the code entry step after sending", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSendEmail(user);

    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
    expect(screen.getByText("husky@northeastern.edu")).toBeInTheDocument();
  });

  it("maps rate-limit failures to actionable copy", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "rate limit exceeded" } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSendEmail(user);

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
  });

  it("maps network failures to a retry-friendly message", async () => {
    signInWithOtp.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSendEmail(user);

    expect(
      await screen.findByText(/couldn't reach the sign-in service/i),
    ).toBeInTheDocument();
  });
});

describe("LoginForm — verify step", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    searchParams.value = "";
    signInWithOtp.mockReset();
    verifyOtp.mockReset();
    routerPush.mockReset();
    routerRefresh.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("code input has one-time-code autocomplete and numeric inputMode", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    const input = screen.getByLabelText(/6-digit code/i);
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("calls verifyOtp with the email and entered code", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "husky@northeastern.edu",
      token: "123456",
      type: "email",
    });
  });

  it("redirects to / after verification with no next param", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
  });

  it("calls router.refresh() after push so server components re-read the session", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/");
      expect(routerRefresh).toHaveBeenCalled();
    });
  });

  it("redirects to the next param after successful verification", async () => {
    searchParams.value = "next=%2Fmarket%2Fabc-123";
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith("/market/abc-123"));
  });

  it("ignores an unsafe next param and redirects to /", async () => {
    searchParams.value = "next=%2F%2Fevil.com";
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
  });

  it("rejects a code shorter than 6 digits without calling verifyOtp", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "123");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(await screen.findByText(/enter all 6 digits/i)).toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("shows an error for an invalid or expired code", async () => {
    verifyOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument();
  });

  it("maps verification rate-limit to actionable copy", async () => {
    verifyOtp.mockResolvedValue({
      error: { message: "too many requests" },
    });
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.type(screen.getByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it("'use a different email' returns to the email step", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.click(screen.getByRole("button", { name: /use a different email/i }));

    expect(screen.getByLabelText(/northeastern email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
  });

  it("resend code calls signInWithOtp again for the same email", async () => {
    const user = userEvent.setup();
    await goToVerifyStep(user);

    await user.click(screen.getByRole("button", { name: /resend code/i }));

    expect(signInWithOtp).toHaveBeenCalledTimes(2);
    expect(signInWithOtp).toHaveBeenLastCalledWith({
      email: "husky@northeastern.edu",
    });
  });
});
