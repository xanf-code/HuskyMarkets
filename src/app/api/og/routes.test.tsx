import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageResponse } from "next/og";
import { BetOgCard } from "@/components/og/BetOgCard";
import { MarketOgCard } from "@/components/og/MarketOgCard";
import { GET as getBetOg } from "./bet/[betId]/route";
import { GET as getMarketOg } from "./market/[id]/route";

const { getMarketCard, getShareCard, getOgFonts } = vi.hoisted(() => ({
  getMarketCard: vi.fn(),
  getShareCard: vi.fn(),
  getOgFonts: vi.fn(),
}));

vi.mock("next/og", () => ({
  ImageResponse: vi.fn(function ImageResponse() {
    return new Response("png", { status: 200 });
  }),
}));

vi.mock("@/lib/queries/share", () => ({ getMarketCard, getShareCard }));
vi.mock("@/lib/og-fonts", () => ({ getOgFonts }));

const FONTS = [{ name: "IBM Plex Mono", data: new ArrayBuffer(0) }];

const marketCard = {
  title: "Will it snow before finals?",
  category: "weather" as const,
  leading: { label: "Yes", price: 63 },
  volume: 550,
  status: "open" as const,
  closeAt: "2026-07-20T00:00:00Z",
};

const shareCard = {
  marketId: "m1",
  marketTitle: "Will it snow before finals?",
  outcomeLabel: "No",
  priceAtBet: 22,
  stake: 250,
  payout: 396,
  displayName: "QuietHusky42",
};

function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getOgFonts.mockResolvedValue(FONTS);
});

describe("GET /api/og/market/[id]", () => {
  it("renders the market card with OG size and fonts", async () => {
    getMarketCard.mockResolvedValue(marketCard);
    const res = await getMarketOg(new Request("http://x"), ctx({ id: "m1" }) as never);
    expect(res.status).toBe(200);
    expect(getMarketCard).toHaveBeenCalledWith("m1");
    const [element, options] = vi.mocked(ImageResponse).mock.calls[0];
    expect(element.type).toBe(MarketOgCard);
    expect((element as { props: { card: unknown } }).props.card).toEqual(
      marketCard,
    );
    expect(options).toMatchObject({ width: 1200, height: 630, fonts: FONTS });
  });

  it("404s for unknown or hidden markets", async () => {
    getMarketCard.mockResolvedValue(null);
    const res = await getMarketOg(new Request("http://x"), ctx({ id: "nope" }) as never);
    expect(res.status).toBe(404);
    expect(ImageResponse).not.toHaveBeenCalled();
  });
});

describe("GET /api/og/bet/[betId]", () => {
  it("renders the share card for a winning bet", async () => {
    getShareCard.mockResolvedValue(shareCard);
    const res = await getBetOg(new Request("http://x"), ctx({ betId: "b1" }) as never);
    expect(res.status).toBe(200);
    expect(getShareCard).toHaveBeenCalledWith("b1");
    const [element, options] = vi.mocked(ImageResponse).mock.calls[0];
    expect(element.type).toBe(BetOgCard);
    expect((element as { props: { card: unknown } }).props.card).toEqual(
      shareCard,
    );
    expect(options).toMatchObject({ width: 1200, height: 630, fonts: FONTS });
  });

  it("404s for losing or unresolved bets", async () => {
    getShareCard.mockResolvedValue(null);
    const res = await getBetOg(new Request("http://x"), ctx({ betId: "loser" }) as never);
    expect(res.status).toBe(404);
    expect(ImageResponse).not.toHaveBeenCalled();
  });
});
