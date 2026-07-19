import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Header", () => {
  it("shows nav and the provided balance slot for an authenticated user", () => {
    render(<Header authenticated balance={<div>1,050 HC</div>} />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(nav).getByRole("link", { name: /markets/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /portfolio/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByText(/1,050 HC/)).toBeInTheDocument();
  });

  it("shows a Log in link for an unauthenticated visitor", () => {
    render(<Header authenticated={false} />);

    const loginLink = screen.getByRole("link", { name: /log in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
    expect(screen.queryByText(/1,050 HC/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /primary/i }),
    ).not.toBeInTheDocument();
  });
});
