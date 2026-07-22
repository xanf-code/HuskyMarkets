import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MarketCardSkeleton,
  MoverCardSkeleton,
  Skeleton,
  TabStripSkeleton,
} from "./Skeleton";

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

describe("MarketCardSkeleton", () => {
  it("mirrors MarketCard with category chip by default", () => {
    const { container } = render(<MarketCardSkeleton />);
    const root = container.firstChild as HTMLElement;

    expect(root).toHaveClass("card-surface", "gap-2", "p-4");
    expect(container.querySelector(".rounded-pill.h-6")).toBeTruthy();
    expect(container.querySelectorAll(".grid.grid-cols-2 .h-11")).toHaveLength(2);
    expect(container.querySelector(".border-t.border-hairline")).toBeTruthy();
    expect(container.querySelectorAll(".grid.grid-cols-3 > *")).toHaveLength(3);
  });

  it("hides the category chip when hideCategory is set", () => {
    const { container } = render(<MarketCardSkeleton hideCategory />);

    expect(container.querySelector(".rounded-pill.h-6")).toBeNull();
    // Title + countdown sit on one row when the section already labels category.
    expect(container.querySelector(".justify-between")).toBeTruthy();
  });
});

describe("MoverCardSkeleton", () => {
  it("uses strip sizing by default", () => {
    const { container } = render(<MoverCardSkeleton />);
    const root = container.firstChild as HTMLElement;

    expect(root).toHaveClass("card-surface", "w-[78%]", "px-4", "py-3");
  });

  it("uses full-width rail sizing for the sidebar", () => {
    const { container } = render(<MoverCardSkeleton layout="rail" />);
    const root = container.firstChild as HTMLElement;

    expect(root).toHaveClass("w-full", "px-5", "py-4");
    expect(root).not.toHaveClass("w-[78%]");
  });
});

describe("TabStripSkeleton", () => {
  it("renders count tabs with underline strip spacing", () => {
    const { container } = render(
      <TabStripSkeleton count={5} widths={["w-12", "w-20"]} />,
    );
    const root = container.firstChild as HTMLElement;

    expect(root).toHaveClass("flex", "gap-6", "border-b", "border-hairline");
    expect(root.children).toHaveLength(5);
    expect(root.children[0]).toHaveClass("h-11", "w-12");
    expect(root.children[1]).toHaveClass("w-20");
    expect(root.children[2]).toHaveClass("w-20"); // default width
  });
});
