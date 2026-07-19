import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Countdown } from "./Countdown";

describe("Countdown", () => {
  it("renders the remaining time to close", () => {
    const closeAt = new Date(Date.now() + 2 * 86_400_000 + 3_600_000);
    render(<Countdown closeAt={closeAt.toISOString()} />);
    expect(screen.getByText(/2d \dh/)).toBeInTheDocument();
  });

  it("renders 'closed' for a past close time", () => {
    const closeAt = new Date(Date.now() - 60_000);
    render(<Countdown closeAt={closeAt.toISOString()} />);
    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});
