import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareBetPage, { generateMetadata } from "./page";

const { getShareCard, notFound } = vi.hoisted(() => ({
  getShareCard: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/queries/share", () => ({ getShareCard }));
vi.mock("next/navigation", () => ({ notFound }));

const card = {
  marketId: "m1",
  marketTitle: "Will it snow before finals?",
  side: "no" as const,
  priceAtBet: 22,
  stake: 250,
  payout: 396,
  displayName: "QuietHusky42",
};

const params = Promise.resolve({ betId: "b1" });

beforeEach(() => {
  vi.clearAllMocks();
  getShareCard.mockResolvedValue(card);
});

describe("share/bet/[betId] generateMetadata", () => {
  it("points the OG image at the bet OG route", async () => {
    const meta = await generateMetadata({ params });
    expect(meta.openGraph?.images).toEqual(["/api/og/bet/b1"]);
    expect(String(meta.title)).toContain("22¢");
  });

  it("404s when the bet is not a shareable win", async () => {
    getShareCard.mockResolvedValue(null);
    await expect(generateMetadata({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("ShareBetPage", () => {
  it("renders the public card content", async () => {
    render(await ShareBetPage({ params }));
    expect(screen.getByText(/Called it at 22¢/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Will it snow before finals?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/250 HC/)).toBeInTheDocument();
    expect(screen.getByText(/396 HC/)).toBeInTheDocument();
    expect(screen.getByText(/QuietHusky42/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view the market/i }),
    ).toHaveAttribute("href", "/market/m1");
  });

  it("404s for losing or unresolved bets", async () => {
    getShareCard.mockResolvedValue(null);
    await expect(ShareBetPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
