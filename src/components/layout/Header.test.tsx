import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Header", () => {
  it("shows nav and the balance chip for an authenticated user", () => {
    render(<Header authenticated />);

    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(nav).getByRole("link", { name: /markets/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /portfolio/i })).toBeInTheDocument();
    expect(screen.getByText(/1,000 HC/)).toBeInTheDocument();
  });

  it("renders nothing for an unauthenticated visitor", () => {
    const { container } = render(<Header authenticated={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/1,000 HC/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /primary/i }),
    ).not.toBeInTheDocument();
  });
});
