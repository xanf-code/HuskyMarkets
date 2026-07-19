import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketStats } from "./MarketStats";

describe("MarketStats", () => {
  it("shows volume, bettor count, and the pool split", () => {
    render(
      <MarketStats yesPool={450} noPool={300} volume={550} bettorCount={3} />,
    );
    expect(screen.getByText("550 HC")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("450 / 300")).toBeInTheDocument();
  });
});
