import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("names the outcome it tracks so the leader is never ambiguous (AR-8)", () => {
    render(<Sparkline points={[50, 67, 60]} label="Yes" colorIndex={0} />);

    expect(
      screen.getByRole("img", { name: "Yes price trend" }),
    ).toBeInTheDocument();
  });

  it("labels a non-binary outcome by its own label, not Yes/No", () => {
    render(
      <Sparkline points={[20, 22]} label="Green Line" colorIndex={3} />,
    );

    expect(
      screen.getByRole("img", { name: "Green Line price trend" }),
    ).toBeInTheDocument();
  });

  it("renders nothing meaningful for empty history without crashing", () => {
    render(<Sparkline points={[]} label="Yes" colorIndex={0} />);

    expect(
      screen.getByRole("img", { name: "Yes price trend" }),
    ).toBeInTheDocument();
  });
});
