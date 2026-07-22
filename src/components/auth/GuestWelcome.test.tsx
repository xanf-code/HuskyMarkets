import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROMO_FALL_2026_KEY,
  dismissPromoBanner,
} from "@/lib/onboarding-flags";
import { SignInPromptProvider } from "./SignInPromptProvider";
import { GuestWelcome } from "./GuestWelcome";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

describe("GuestWelcome", () => {
  it("stays hidden while the promo banner has not been dismissed", () => {
    render(<GuestWelcome />, { wrapper: Wrapper });
    expect(screen.queryByText(/predict campus events/i)).not.toBeInTheDocument();
  });

  it("appears once the promo banner has been dismissed", async () => {
    localStorage.setItem(PROMO_FALL_2026_KEY, "1");
    render(<GuestWelcome />, { wrapper: Wrapper });
    expect(await screen.findByText(/predict campus events/i)).toBeInTheDocument();
  });

  it("reveals immediately when the promo banner is dismissed in-session", async () => {
    render(<GuestWelcome />, { wrapper: Wrapper });
    expect(screen.queryByText(/predict campus events/i)).not.toBeInTheDocument();

    dismissPromoBanner();

    expect(await screen.findByText(/predict campus events/i)).toBeInTheDocument();
  });
});
