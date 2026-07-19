import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SemesterBoard } from "./SemesterBoard";

describe("SemesterBoard", () => {
  it("highlights the current user and renders serif ranks", () => {
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
});
