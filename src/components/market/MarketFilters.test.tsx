import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketFilters } from "./MarketFilters";

const { replace, params } = vi.hoisted(() => ({
  replace: vi.fn(),
  params: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/",
  useSearchParams: () => params.current,
}));

beforeEach(() => {
  vi.clearAllMocks();
  params.current = new URLSearchParams();
});

describe("MarketFilters", () => {
  it("writes the category into the URL", async () => {
    const user = userEvent.setup();
    render(<MarketFilters />);

    await user.click(screen.getByRole("button", { name: "Transit" }));

    expect(replace).toHaveBeenCalledWith("/?category=transit", {
      scroll: false,
    });
  });

  it("clears the category when the active chip is clicked again", async () => {
    params.current = new URLSearchParams("category=transit");
    const user = userEvent.setup();
    render(<MarketFilters />);

    await user.click(screen.getByRole("button", { name: "Transit" }));

    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("writes the sort into the URL", async () => {
    const user = userEvent.setup();
    render(<MarketFilters />);

    await user.selectOptions(screen.getByLabelText(/sort/i), "volume");

    expect(replace).toHaveBeenCalledWith("/?sort=volume", { scroll: false });
  });

  it("submits the search box and preserves other params", async () => {
    params.current = new URLSearchParams("category=weather");
    const user = userEvent.setup();
    render(<MarketFilters />);

    await user.type(screen.getByRole("searchbox"), "snow{Enter}");

    expect(replace).toHaveBeenCalledWith("/?category=weather&q=snow", {
      scroll: false,
    });
  });
});
