import { describe, expect, it } from "vitest";
import type { MarketListItem } from "@/lib/queries/markets";
import {
  applyMarketUpdate,
  applyOutcomeUpdate,
  appendHistoryPoint,
  describePayout,
  patchMarketList,
  patchMarketListOutcome,
  prependActivity,
  type LiveMarketState,
} from "./live-state";

const state: LiveMarketState = {
  outcomes: [
    { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
    { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 },
  ],
  status: "open",
  winningOutcomeId: null,
};

describe("applyMarketUpdate", () => {
  it("patches status and winning outcome from a markets row, immutably", () => {
    const next = applyMarketUpdate(state, {
      status: "resolved",
      winning_outcome_id: "o-yes",
    });

    expect(next.status).toBe("resolved");
    expect(next.winningOutcomeId).toBe("o-yes");
    expect(next.outcomes).toBe(state.outcomes);
    expect(state.status).toBe("open");
  });

  it("keeps current values for fields absent from the payload", () => {
    expect(applyMarketUpdate(state, { status: "closed" })).toEqual({
      outcomes: state.outcomes,
      status: "closed",
      winningOutcomeId: null,
    });
  });
});

describe("applyOutcomeUpdate", () => {
  it("patches the outcome pool and recomputes every implied price", () => {
    const next = applyOutcomeUpdate(state, { id: "o-yes", pool: 300 });

    expect(next.outcomes).toEqual([
      { id: "o-yes", label: "Yes", sortOrder: 0, pool: 300, implied: 75 },
      { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 25 },
    ]);
    expect(state.outcomes[0].pool).toBe(200);
  });

  it("is a no-op for an unknown outcome or an unchanged pool", () => {
    expect(applyOutcomeUpdate(state, { id: "nope", pool: 999 })).toBe(state);
    expect(applyOutcomeUpdate(state, { id: "o-yes", pool: 200 })).toBe(state);
  });
});

describe("appendHistoryPoint", () => {
  const history = [
    { recordedAt: "2026-07-18T10:00:00Z", outcomeId: "o-yes", price: 50 },
    { recordedAt: "2026-07-18T10:15:00Z", outcomeId: "o-yes", price: 67 },
  ];

  it("appends a mapped point at the end", () => {
    const next = appendHistoryPoint(history, {
      recorded_at: "2026-07-18T10:30:00Z",
      outcome_id: "o-yes",
      implied: 60,
    });

    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({
      recordedAt: "2026-07-18T10:30:00Z",
      outcomeId: "o-yes",
      price: 60,
    });
    expect(history).toHaveLength(2);
  });

  it("keeps every outcome of a shared-timestamp snapshot (AR-1 regression)", () => {
    // One bet snapshots all N outcomes under a single transaction timestamp;
    // identity is (outcome_id, recorded_at), never recorded_at alone.
    let next = history;
    for (let i = 0; i < 6; i += 1) {
      next = appendHistoryPoint(next, {
        recorded_at: "2026-07-18T10:30:00Z",
        outcome_id: `o-${i}`,
        implied: 10 * i,
      });
    }

    expect(next).toHaveLength(2 + 6);
    expect(next.slice(2).map((p) => p.outcomeId)).toEqual([
      "o-0",
      "o-1",
      "o-2",
      "o-3",
      "o-4",
      "o-5",
    ]);
  });

  it("skips a redelivered point with an already-seen (outcome, timestamp)", () => {
    const next = appendHistoryPoint(history, {
      recorded_at: "2026-07-18T10:15:00Z",
      outcome_id: "o-yes",
      implied: 67,
    });

    expect(next).toBe(history);
  });
});

describe("prependActivity", () => {
  const item = (id: string) => ({
    id,
    outcomeId: "o-yes",
    outcomeLabel: "Yes",
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
    outcomes: [
      { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
      { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 },
    ],
    volume: 100,
    bettorCount: 2,
    spark: [50, 67],
  };

  it("drops a card once its market leaves the open state or is hidden", () => {
    expect(
      patchMarketList([listItem], { id: "m1", status: "closed" }),
    ).toEqual([]);
    expect(
      patchMarketList([listItem], { id: "m1", hidden: true }),
    ).toEqual([]);
  });

  it("carries no price data — markets-row updates leave the card untouched", () => {
    const items = [listItem];

    expect(patchMarketList(items, { id: "m1", status: "open" })).toBe(items);
  });

  it("leaves the list untouched for an unknown market id", () => {
    const items = [listItem];

    expect(patchMarketList(items, { id: "other", status: "closed" })).toBe(
      items,
    );
  });
});

describe("patchMarketListOutcome", () => {
  const listItem: MarketListItem = {
    id: "m1",
    title: "Will it snow in Boston before finals week?",
    category: "weather",
    closeAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-07-10T00:00:00Z",
    outcomes: [
      { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
      { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 },
    ],
    volume: 100,
    bettorCount: 2,
    spark: [50, 67],
  };

  it("patches pools, implied prices, volume, and the spark tail", () => {
    const next = patchMarketListOutcome([listItem], {
      market_id: "m1",
      id: "o-yes",
      pool: 300,
    });

    // 300/400 → 75¢; volume = 400 − 200 seed = 200; leader still o-yes
    expect(next[0].outcomes).toEqual([
      { id: "o-yes", label: "Yes", sortOrder: 0, pool: 300, implied: 75 },
      { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 25 },
    ]);
    expect(next[0].volume).toBe(200);
    expect(next[0].spark).toEqual([50, 67, 75]);
    expect(listItem.outcomes[0].pool).toBe(200);
  });

  it("re-anchors the spark to the new leading outcome when the lead flips", () => {
    const next = patchMarketListOutcome([listItem], {
      market_id: "m1",
      id: "o-no",
      pool: 500,
    });

    // o-no now leads at 500/700 → 71¢
    expect(next[0].spark).toEqual([71]);
    expect(next[0].volume).toBe(500);
  });

  it("leaves the list untouched for an unknown market or outcome", () => {
    const items = [listItem];

    expect(
      patchMarketListOutcome(items, { market_id: "other", id: "o-yes", pool: 1 }),
    ).toBe(items);
    expect(
      patchMarketListOutcome(items, { market_id: "m1", id: "nope", pool: 1 }),
    ).toBe(items);
  });
});

describe("describePayout", () => {
  const market = {
    title: "Will it snow in Boston before finals week?",
    status: "resolved" as const,
    winningLabel: "Yes",
  };

  it("announces payouts with the winning outcome's label", () => {
    expect(describePayout({ type: "bet_payout", amount: 158 }, market)).toBe(
      '+158 HC — called it on "Will it snow in Boston before finals week?" (Yes)',
    );
    expect(
      describePayout(
        { type: "bet_payout", amount: 96 },
        { ...market, winningLabel: "Gamma" },
      ),
    ).toBe(
      '+96 HC — called it on "Will it snow in Boston before finals week?" (Gamma)',
    );
  });

  it("degrades to generic copy when the label or market cannot be read", () => {
    expect(
      describePayout(
        { type: "bet_payout", amount: 158 },
        { title: market.title, status: "resolved" },
      ),
    ).toBe('+158 HC — called it on "Will it snow in Boston before finals week?"');
    expect(describePayout({ type: "bet_payout", amount: 158 }, null)).toBe(
      "+158 HC — you called it",
    );
  });

  it("announces refunds", () => {
    expect(
      describePayout({ type: "market_refund", amount: 100 }, market),
    ).toBe(
      '+100 HC — stake back on "Will it snow in Boston before finals week?"',
    );
  });

  it("stays silent for every other transaction type", () => {
    expect(describePayout({ type: "bet_place", amount: -50 }, null)).toBeNull();
    expect(describePayout({ type: "daily_bonus", amount: 50 }, null)).toBeNull();
    expect(describePayout({ type: "signup_grant", amount: 1000 }, null)).toBeNull();
  });
});
