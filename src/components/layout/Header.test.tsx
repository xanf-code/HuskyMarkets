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

  it("renders nothing for an unauthenticated visitor", () => {
    const { container } = render(
      <Header authenticated={false} balance={<div>1,050 HC</div>} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/1,050 HC/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /primary/i }),
    ).not.toBeInTheDocument();
  });
});
