import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "./Tabs";

const tabs = [
  { id: "markets", label: "Markets" },
  { id: "portfolio", label: "Portfolio" },
  { id: "leaderboard", label: "Leaderboard" },
];

describe("Tabs", () => {
  it("marks the active tab as selected", () => {
    render(<Tabs tabs={tabs} active="portfolio" onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: "Portfolio" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Markets" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("reports the clicked tab id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="markets" onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "Leaderboard" }));

    expect(onChange).toHaveBeenCalledWith("leaderboard");
  });
});
