import { describe, expect, it } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import {
  applyMarketUpdate,
  appendHistoryPoint,
  describePayout,
  patchMarketList,
  prependActivity,
  type LiveMarketState,
} from "./live-state";

const state: LiveMarketState = { yesPool: 200, noPool: 100, status: "open" };

describe("applyMarketUpdate", () => {
  it("patches pools and status immutably", () => {
    const next = applyMarketUpdate(state, {
      yes_pool: 300,
      no_pool: 150,
      status: "closed",
    });

    expect(next).toEqual({ yesPool: 300, noPool: 150, status: "closed" });
    expect(state).toEqual({ yesPool: 200, noPool: 100, status: "open" });
  });

  it("keeps current values for fields absent from the payload", () => {
    expect(applyMarketUpdate(state, { yes_pool: 250 })).toEqual({
      yesPool: 250,
      noPool: 100,
      status: "open",
    });
  });
});

describe("appendHistoryPoint", () => {
  const history = [
    { recordedAt: "2026-07-18T10:00:00Z", price: 50 },
    { recordedAt: "2026-07-18T10:15:00Z", price: 67 },
  ];

  it("appends a mapped point at the end", () => {
    const next = appendHistoryPoint(history, {
      recorded_at: "2026-07-18T10:30:00Z",
      implied_yes: 60,
    });

    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ recordedAt: "2026-07-18T10:30:00Z", price: 60 });
    expect(history).toHaveLength(2);
  });

  it("skips a redelivered point with an already-seen timestamp", () => {
    const next = appendHistoryPoint(history, {
      recorded_at: "2026-07-18T10:15:00Z",
      implied_yes: 67,
    });

    expect(next).toBe(history);
  });
});

describe("prependActivity", () => {
  const item = (id: string) => ({
    id,
    displayName: "CunningHusky42",
    side: "yes" as const,
    amount: 50,
    price: 67,
    createdAt: "2026-07-18T10:00:00Z",
  });

  it("puts the newest bet first and caps the feed length", () => {
    const feed = [item("b1"), item("b2"), item("b3")];

    const next = prependActivity(feed, item("b4"), 3);

    expect(next.map((b) => b.id)).toEqual(["b4", "b1", "b2"]);
    expect(feed).toHaveLength(3);
  });

  it("ignores a bet already in the feed", () => {
    const feed = [item("b1")];

    expect(prependActivity(feed, item("b1"), 30)).toBe(feed);
  });
});

describe("patchMarketList", () => {
  const listItem: MarketListItem = {
    id: "m1",
    title: "Will it snow in Boston before finals week?",
    category: "weather",
    closeAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-07-10T00:00:00Z",
    yesPool: 200,
    noPool: 100,
    impliedYes: 67,
    volume: 100,
    spark: [50, 67],
  };

  it("patches price, volume, and spark tail for the matching card", () => {
    const next = patchMarketList([listItem], {
      id: "m1",
      yes_pool: 300,
      no_pool: 150,
      status: "open",
    });

    // 300/450 → 67¢; volume = 450 − 200 seed = 250
    expect(next[0]).toMatchObject({
      yesPool: 300,
      noPool: 150,
      impliedYes: 67,
      volume: 250,
      spark: [50, 67, 67],
    });
    expect(listItem.yesPool).toBe(200);
  });

  it("drops a card once its market leaves the open state or is hidden", () => {
    expect(
      patchMarketList([listItem], { id: "m1", status: "closed" }),
    ).toEqual([]);
    expect(
      patchMarketList([listItem], { id: "m1", hidden: true }),
    ).toEqual([]);
  });

  it("leaves the list untouched for an unknown market id", () => {
    const items = [listItem];

    expect(patchMarketList(items, { id: "other", yes_pool: 999 })).toBe(items);
  });
});

describe("describePayout", () => {
  const market = {
    title: "Will it snow in Boston before finals week?",
    status: "resolved_yes" as const,
  };

  it("announces payouts with the market's resolution", () => {
    expect(describePayout({ type: "bet_payout", amount: 158 }, market)).toBe(
      '+158 HC — "Will it snow in Boston before finals week?" resolved YES',
    );
    expect(
      describePayout(
        { type: "bet_payout", amount: 96 },
        { ...market, status: "resolved_no" },
      ),
    ).toBe('+96 HC — "Will it snow in Boston before finals week?" resolved NO');
  });

  it("falls back to generic copy when the market cannot be read", () => {
    expect(describePayout({ type: "bet_payout", amount: 158 }, null)).toBe(
      "+158 HC — market resolved",
    );
  });

  it("announces refunds", () => {
    expect(
      describePayout({ type: "market_refund", amount: 100 }, market),
    ).toBe(
      '+100 HC — stake refunded on "Will it snow in Boston before finals week?"',
    );
  });

  it("stays silent for every other transaction type", () => {
    expect(describePayout({ type: "bet_place", amount: -50 }, null)).toBeNull();
    expect(describePayout({ type: "daily_bonus", amount: 50 }, null)).toBeNull();
    expect(describePayout({ type: "signup_grant", amount: 1000 }, null)).toBeNull();
  });
});
