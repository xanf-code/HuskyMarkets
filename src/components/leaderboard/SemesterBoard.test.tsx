import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemesterBoard } from "./SemesterBoard";

function stubIntersectionObserver() {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn();
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

describe("SemesterBoard", () => {
  beforeEach(stubIntersectionObserver);
  afterEach(() => vi.unstubAllGlobals());

  it("highlights the current user and renders ranks", () => {
    render(
      <SemesterBoard
        currentUserId="u2"
        entries={[
          {
            rank: 1,
            userId: "u1",
            displayName: "Alice",
            score: 1200,
          },
          {
            rank: 2,
            userId: "u2",
            displayName: "Bob",
            score: 1100,
          },
        ]}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/Bob \(you\)/)).toBeInTheDocument();
    expect(screen.getByText("1,200 HC")).toBeInTheDocument();
  });

  it("paginates long boards and shows a scroll sentinel", () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      rank: i + 1,
      userId: `u${i}`,
      displayName: `Trader ${i}`,
      score: 2000 - i * 10,
    }));
    render(<SemesterBoard entries={entries} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(15);
    expect(screen.getByRole("status")).toHaveTextContent("5 more");
  });
});
