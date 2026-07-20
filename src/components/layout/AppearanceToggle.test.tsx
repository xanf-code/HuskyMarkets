import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APPEARANCE_COOKIE } from "@/lib/appearance";
import { AppearanceToggle } from "./AppearanceToggle";

function clearAppearanceCookie() {
  document.cookie = `${APPEARANCE_COOKIE}=; path=/; max-age=0`;
}

describe("AppearanceToggle", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    clearAppearanceCookie();
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    clearAppearanceCookie();
  });

  it("renders off when the initial appearance is light", () => {
    render(<AppearanceToggle initialAppearance="light" />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/off/i)).toBeInTheDocument();
  });

  it("renders on when the initial appearance is dark", () => {
    // In production the root layout already set this class from the same
    // cookie by the time any client component mounts; `initialAppearance`
    // only guards against a hydration-mismatch warning. Mirror that here.
    document.documentElement.classList.add("dark");
    render(<AppearanceToggle initialAppearance="dark" />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/on for this device/i)).toBeInTheDocument();
  });

  it("flips the dark class on <html> and persists the choice in a cookie", async () => {
    const user = userEvent.setup();
    render(<AppearanceToggle initialAppearance="light" />);

    await user.click(screen.getByRole("switch"));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain(`${APPEARANCE_COOKIE}=dark`);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("switch"));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.cookie).toContain(`${APPEARANCE_COOKIE}=light`);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
