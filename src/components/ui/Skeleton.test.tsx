import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders a decorative pulse block hidden from assistive tech", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;

    expect(el).toHaveAttribute("aria-hidden");
    expect(el).toHaveClass("animate-pulse", "rounded-md", "bg-muted");
  });

  it("appends caller-provided classes for sizing", () => {
    const { container } = render(<Skeleton className="h-8 w-24 rounded-pill" />);
    const el = container.firstChild as HTMLElement;

    expect(el).toHaveClass("animate-pulse", "bg-muted", "h-8", "w-24", "rounded-pill");
  });
});
