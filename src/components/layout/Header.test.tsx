import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

describe("Header", () => {
  it("keeps full primary nav in the DOM for authenticated users (visible from md up; phones use BottomNav)", () => {
    render(<Header authenticated balance={<div>1,050 HC</div>} />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(nav).getByRole("link", { name: /markets/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /portfolio/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /leaderboard/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /create/i })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /profile/i })).not.toBeInTheDocument();
    expect(screen.getByText(/1,050 HC/)).toBeInTheDocument();
  });

  it("shows a user menu button for an authenticated user", () => {
    render(<Header authenticated balance={<div>1,050 HC</div>} />);

    expect(
      screen.getByRole("button", { name: /user menu/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("shows the trimmed guest nav with no sign-in button for an unauthenticated visitor", () => {
    render(<Header authenticated={false} />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(nav).getByRole("link", { name: /markets/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /leaderboard/i })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /portfolio/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /create/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /profile/i })).not.toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/1,050 HC/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});
