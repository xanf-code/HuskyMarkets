import { describe, expect, it } from "vitest";
import {
  aggregateOpenPositions,
  aggregateResolved,
  type BetRow,
  type MarketRow,
  type PayoutRow,
} from "./portfolio";

const openMarket: MarketRow = {
  id: "m-open",
  title: "Will the Green Line delay?",
  status: "open",
  close_at: "2026-07-20T20:00:00Z",
  yes_pool: 450,
  no_pool: 300,
  resolved_at: null,
};

const resolvedYes: MarketRow = {
  id: "m-yes",
  title: "Snow before finals?",
  status: "resolved_yes",
  close_at: "2026-07-01T20:00:00Z",
  yes_pool: 400,
  no_pool: 200,
  resolved_at: "2026-07-02T12:00:00Z",
};

describe("aggregateOpenPositions", () => {
  it("sums stakes per market+side and computes avg price + implied value", () => {
    const bets: BetRow[] = [
      {
        market_id: "m-open",
        side: "yes",
        amount: 100,
        price_at_bet: 50,
        created_at: "2026-07-10T10:00:00Z",
      },
      {
        market_id: "m-open",
        side: "yes",
        amount: 50,
        price_at_bet: 64,
        created_at: "2026-07-11T10:00:00Z",
      },
      {
        market_id: "m-open",
        side: "no",
        amount: 25,
        price_at_bet: 40,
        created_at: "2026-07-11T11:00:00Z",
      },
    ];

    const positions = aggregateOpenPositions(bets, [openMarket]);

    expect(positions).toHaveLength(2);
    const yes = positions.find((p) => p.side === "yes")!;
    expect(yes.stake).toBe(150);
    // weighted avg: (100*50 + 50*64) / 150 = 54.666… → 55
    expect(yes.avgPrice).toBe(55);
    // positionValue(150, 450, 750) = floor(150 * 713 / 450) = 237
    expect(yes.impliedValue).toBe(237);
    expect(yes.marketTitle).toBe("Will the Green Line delay?");
    expect(yes.closeAt).toBe("2026-07-20T20:00:00Z");

    const no = positions.find((p) => p.side === "no")!;
    expect(no.stake).toBe(25);
    expect(no.avgPrice).toBe(40);
  });

  it("ignores bets on resolved markets", () => {
    const bets: BetRow[] = [
      {
        market_id: "m-yes",
        side: "yes",
        amount: 100,
        price_at_bet: 50,
        created_at: "2026-07-01T10:00:00Z",
      },
    ];
    expect(aggregateOpenPositions(bets, [resolvedYes])).toEqual([]);
  });
});

describe("aggregateResolved", () => {
  it("computes stake → payout P&L for a winning YES position", () => {
    const bets: BetRow[] = [
      {
        market_id: "m-yes",
        side: "yes",
        amount: 100,
        price_at_bet: 50,
        created_at: "2026-07-01T10:00:00Z",
      },
    ];
    const payouts: PayoutRow[] = [
      { market_id: "m-yes", type: "bet_payout", amount: 158 },
    ];

    const rows = aggregateResolved(bets, [resolvedYes], payouts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      marketId: "m-yes",
      outcome: "yes",
      side: "yes",
      stake: 100,
      payout: 158,
      pnl: 58,
      won: true,
    });
  });

  it("treats a voided market refund as zero P&L", () => {
    const voided: MarketRow = {
      ...resolvedYes,
      id: "m-void",
      status: "voided",
    };
    const bets: BetRow[] = [
      {
        market_id: "m-void",
        side: "no",
        amount: 80,
        price_at_bet: 40,
        created_at: "2026-07-01T10:00:00Z",
      },
    ];
    const payouts: PayoutRow[] = [
      { market_id: "m-void", type: "market_refund", amount: 80 },
    ];

    const rows = aggregateResolved(bets, [voided], payouts);
    expect(rows[0]).toMatchObject({
      stake: 80,
      payout: 80,
      pnl: 0,
      won: false,
      outcome: "void",
    });
  });

  it("records a full stake loss when the other side won", () => {
    const bets: BetRow[] = [
      {
        market_id: "m-yes",
        side: "no",
        amount: 50,
        price_at_bet: 45,
        created_at: "2026-07-01T10:00:00Z",
      },
    ];
    const rows = aggregateResolved(bets, [resolvedYes], []);
    expect(rows[0]).toMatchObject({
      stake: 50,
      payout: 0,
      pnl: -50,
      won: false,
    });
  });
});
