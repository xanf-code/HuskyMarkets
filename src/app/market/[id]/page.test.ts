import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./page";

const { getMarketCard } = vi.hoisted(() => ({ getMarketCard: vi.fn() }));

vi.mock("@/lib/queries/share", () => ({ getMarketCard }));

// Page body deps are irrelevant to generateMetadata but must resolve.
vi.mock("@/components/market/MarketLive", () => ({
  MarketLiveProvider: () => null,
  LiveActivity: () => null,
  LiveChart: () => null,
  LiveOrderPanel: () => null,
  LivePrice: () => null,
  LiveStats: () => null,
  LiveStatusBanner: () => null,
}));
vi.mock("@/components/market/Countdown", () => ({ Countdown: () => null }));
vi.mock("@/components/market/ReportDialog", () => ({ ReportDialog: () => null }));
vi.mock("@/lib/queries/markets", () => ({ getMarketDetail: vi.fn() }));

const card = {
  title: "Will it snow before finals?",
  category: "weather" as const,
  leading: { label: "Yes", price: 63 },
  volume: 550,
  status: "open" as const,
  closeAt: "2026-07-20T00:00:00Z",
};

const params = Promise.resolve({ id: "m1" });

beforeEach(() => {
  vi.clearAllMocks();
  getMarketCard.mockResolvedValue(card);
});

describe("market/[id] generateMetadata", () => {
  it("titles the page with the market and points OG images at the market OG route", async () => {
    const meta = await generateMetadata({ params });
    expect(String(meta.title)).toContain("Will it snow before finals?");
    expect(String(meta.description)).toContain("63%");
    expect(meta.openGraph?.images).toEqual(["/api/og/market/m1"]);
  });

  it("falls back to generic metadata when the card is unavailable", async () => {
    getMarketCard.mockResolvedValue(null);
    const meta = await generateMetadata({ params });
    expect(meta.openGraph?.images ?? []).toEqual([]);
  });
});
