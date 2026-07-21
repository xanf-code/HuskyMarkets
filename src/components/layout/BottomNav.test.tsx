import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portfolio",
}));

describe("BottomNav", () => {
  it("renders the authenticated primary destinations with the current page marked", () => {
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(nav).getByRole("link", { name: /markets/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(nav).getByRole("link", { name: /portfolio/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: /leaderboard/i }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /create/i })).toBeInTheDocument();
  });
});
