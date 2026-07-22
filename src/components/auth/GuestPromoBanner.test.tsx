import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROMO_FALL_2026_KEY } from "@/lib/onboarding-flags";
import { SignInPromptProvider } from "./SignInPromptProvider";
import { GuestPromoBanner } from "./GuestPromoBanner";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SignInPromptProvider>{children}</SignInPromptProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("GuestPromoBanner", () => {
  it("shows when the promo has not been dismissed", async () => {
    render(<GuestPromoBanner />, { wrapper: Wrapper });
    expect(await screen.findByText(/\$150 Campus Store Gift Card/i)).toBeInTheDocument();
  });

  it("stays hidden when the promo was previously dismissed", () => {
    localStorage.setItem(PROMO_FALL_2026_KEY, "1");
    render(<GuestPromoBanner />, { wrapper: Wrapper });
    expect(screen.queryByText(/\$150 Campus Store Gift Card/i)).not.toBeInTheDocument();
  });

  it("hides and persists dismissal when the × button is clicked", async () => {
    const user = userEvent.setup();
    render(<GuestPromoBanner />, { wrapper: Wrapper });

    await screen.findByText(/\$150 Campus Store Gift Card/i);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText(/\$150 Campus Store Gift Card/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(PROMO_FALL_2026_KEY)).toBe("1");
  });
});
