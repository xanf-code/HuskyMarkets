import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminLoading from "@/app/admin/loading";
import CreateLoading from "@/app/create/loading";
import HomeLoading from "@/app/loading";
import LeaderboardLoading from "@/app/leaderboard/loading";
import LoginLoading from "@/app/login/loading";
import MarketLoading from "@/app/market/[id]/loading";
import ModLoading from "@/app/mod/loading";
import OnboardingLoading from "@/app/onboarding/loading";
import PortfolioLoading from "@/app/portfolio/loading";
import ProfileLoading from "@/app/profile/loading";
import ShareBetLoading from "@/app/share/bet/[betId]/loading";

describe("route loading skeletons", () => {
  it("home mirrors showcase sections + movers rail chrome", () => {
    const { container } = render(<HomeLoading />);
    const root = container.firstChild as HTMLElement;

    expect(root).toHaveClass("gap-8", "sm:gap-10");
    expect(
      container.querySelector(
        ".lg\\:grid.lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_22rem\\]",
      ),
    ).toBeTruthy();
    expect(container.querySelector("aside.lg\\:sticky.lg\\:top-24")).toBeTruthy();
    // Three category sections × four hideCategory cards.
    expect(container.querySelectorAll(".card-surface.gap-2.p-4")).toHaveLength(
      12,
    );
  });

  it("market detail mirrors sticky panel grid and supporting blocks", () => {
    const { container } = render(<MarketLoading />);
    const root = container.firstChild as HTMLElement;

    expect(root.className).toContain("lg:grid-rows-[auto_auto_1fr]");
    expect(root.className).toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
    expect(container.querySelector(".lg\\:top-24.lg\\:row-span-3")).toBeTruthy();
    expect(
      container.querySelector(".card-surface.flex.flex-col.gap-4.p-4"),
    ).toBeTruthy();
    expect(container.querySelector(".h-56.sm\\:h-72")).toBeTruthy();
    expect(
      container.querySelectorAll(".grid.sm\\:grid-cols-3 > .card-surface"),
    ).toHaveLength(3);
  });

  it("portfolio mirrors five tabs and position card rows", () => {
    const { container } = render(<PortfolioLoading />);

    expect(container.querySelector(".max-w-3xl")).toBeTruthy();
    expect(
      container.querySelector(".flex.gap-6.border-b")?.children,
    ).toHaveLength(5);
    expect(container.querySelectorAll("li.card-surface")).toHaveLength(4);
  });

  it("leaderboard uses plain hero, prize card, and divided board", () => {
    const { container } = render(<LeaderboardLoading />);

    expect(container.querySelector(".bg-inverse")).toBeNull();
    expect(
      container.querySelector("aside.card-surface.flex.items-center"),
    ).toBeTruthy();
    expect(
      container.querySelector(".flex.gap-6.border-b")?.children,
    ).toHaveLength(3);
    expect(container.querySelectorAll("ol.card-surface > li")).toHaveLength(6);
  });

  it("profile mirrors identity, career stats, and settings cards", () => {
    const { container } = render(<ProfileLoading />);

    expect(container.querySelector(".max-w-2xl")).toBeTruthy();
    expect(container.querySelectorAll("section")).toHaveLength(3);
    expect(
      container.querySelectorAll(".sm\\:grid-cols-3.sm\\:divide-x"),
    ).toHaveLength(2);
  });

  it("create mirrors content-rule aside without a wrapping form card", () => {
    const { container } = render(<CreateLoading />);

    expect(container.querySelector(".bg-red\\/5")).toBeTruthy();
    // No single outer form card wrapping every field.
    const formShell = container.querySelector(".max-w-xl > .flex.flex-col.gap-6");
    expect(formShell).toBeTruthy();
    expect(formShell).not.toHaveClass("card-surface");
  });

  it("onboarding mirrors how-it-works list and option cards", () => {
    const { container } = render(<OnboardingLoading />);

    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(
      container.querySelectorAll(".rounded-lg.border.border-hairline"),
    ).toHaveLength(2);
    expect(container.querySelector(".grid.grid-cols-2")).toBeTruthy();
  });

  it("mod mirrors three divided queue sections", () => {
    const { container } = render(<ModLoading />);

    expect(container.querySelectorAll("section")).toHaveLength(3);
    expect(
      container.querySelectorAll("ul.card-surface.divide-y"),
    ).toHaveLength(3);
  });

  it("admin overview mirrors four queue cards", () => {
    const { container } = render(<AdminLoading />);

    expect(container.querySelectorAll("li.card-surface")).toHaveLength(4);
  });

  it("share bet mirrors stake row and bordered action footer", () => {
    const { container } = render(<ShareBetLoading />);

    expect(container.querySelector(".border-t.border-hairline.pt-6")).toBeTruthy();
    expect(container.querySelector(".mt-6.flex.flex-wrap")).toBeTruthy();
  });

  it("login mirrors heading + form field stack", () => {
    const { container } = render(<LoginLoading />);

    expect(container.querySelector(".max-w-md")).toBeTruthy();
    expect(container.querySelector(".flex.flex-col.gap-4")).toBeTruthy();
  });
});
