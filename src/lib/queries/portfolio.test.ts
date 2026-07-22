import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggregateOpenPositions,
  aggregateResolved,
  aggregateBetHistory,
  getUserCreatedMarkets,
  type BetRow,
  type MarketRow,
  type PayoutRow,
} from "./portfolio";

// ── Supabase mock (only used by getUserCreatedMarkets tests) ─────────────

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));

function chainable(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "order", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

const openMarket: MarketRow = {
  id: "m-open",
  title: "Will the Green Line delay?",
  status: "open",
  close_at: "2026-07-20T20:00:00Z",
  resolved_at: null,
  winning_outcome_id: null,
  outcomes: [
    { id: "o-yes", label: "Yes", sort_order: 0, pool: 450 },
    { id: "o-no", label: "No", sort_order: 1, pool: 300 },
  ],
};

const resolvedMarket: MarketRow = {
  id: "m-res",
  title: "Snow before finals?",
  status: "resolved",
  close_at: "2026-07-01T20:00:00Z",
  resolved_at: "2026-07-02T12:00:00Z",
  winning_outcome_id: "o-yes",
  outcomes: [
    { id: "o-yes", label: "Yes", sort_order: 0, pool: 400 },
    { id: "o-no", label: "No", sort_order: 1, pool: 200 },
  ],
};

const bet = (overrides: Partial<BetRow>): BetRow => ({
  id: "b-id",
  market_id: "m-open",
  outcome_id: "o-yes",
  amount: 100,
  price_at_bet: 50,
  created_at: "2026-07-10T10:00:00Z",
  ...overrides,
});

describe("aggregateOpenPositions", () => {
  it("groups stakes per market+outcome and computes avg price + implied value", () => {
    const bets: BetRow[] = [
      bet({ amount: 100, price_at_bet: 50 }),
      bet({ amount: 50, price_at_bet: 64 }),
      bet({ outcome_id: "o-no", amount: 25, price_at_bet: 40 }),
    ];

    const positions = aggregateOpenPositions(bets, [openMarket]);

    expect(positions).toHaveLength(2);
    const yes = positions.find((p) => p.outcomeId === "o-yes")!;
    expect(yes.outcomeLabel).toBe("Yes");
    expect(yes.stake).toBe(150);
    // weighted avg: (100*50 + 50*64) / 150 = 54.666… → 55
    expect(yes.avgPrice).toBe(55);
    // positionValue(150, 450, 750) = floor(150 * 713 / 450) = 237
    expect(yes.impliedValue).toBe(237);
    expect(yes.marketTitle).toBe("Will the Green Line delay?");
    expect(yes.closeAt).toBe("2026-07-20T20:00:00Z");

    const no = positions.find((p) => p.outcomeId === "o-no")!;
    expect(no.outcomeLabel).toBe("No");
    expect(no.stake).toBe(25);
    expect(no.avgPrice).toBe(40);
  });

  it("keeps hedged stakes on separate outcomes as distinct rows (FR-8/FR-20)", () => {
    const bets: BetRow[] = [
      bet({ outcome_id: "o-yes", amount: 100 }),
      bet({ outcome_id: "o-no", amount: 100 }),
    ];

    const positions = aggregateOpenPositions(bets, [openMarket]);

    expect(positions).toHaveLength(2);
  });

  it("ignores bets on resolved markets", () => {
    const bets: BetRow[] = [bet({ market_id: "m-res" })];
    expect(aggregateOpenPositions(bets, [resolvedMarket])).toEqual([]);
  });
});

describe("aggregateResolved", () => {
  it("computes stake → payout P&L when the backed outcome won", () => {
    const bets: BetRow[] = [bet({ market_id: "m-res", outcome_id: "o-yes" })];
    const payouts: PayoutRow[] = [
      { market_id: "m-res", type: "bet_payout", amount: 158 },
    ];

    const rows = aggregateResolved(bets, [resolvedMarket], payouts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      marketId: "m-res",
      outcomeLabel: "Yes",
      stake: 100,
      payout: 158,
      pnl: 58,
      won: true,
    });
  });

  it("estimates the bet-time payout from the recorded outcome price (FR-21)", () => {
    // 100 HC at 50¢ → est. payout 200; 40 HC at 25¢ → est. 160. Sum: 360.
    const bets: BetRow[] = [
      bet({ market_id: "m-res", outcome_id: "o-yes", amount: 100, price_at_bet: 50 }),
      bet({ id: "b-2", market_id: "m-res", outcome_id: "o-yes", amount: 40, price_at_bet: 25 }),
    ];
    const payouts: PayoutRow[] = [
      { market_id: "m-res", type: "bet_payout", amount: 300 },
    ];

    const rows = aggregateResolved(bets, [resolvedMarket], payouts);
    expect(rows[0].estimatedPayout).toBe(360);
    expect(rows[0].payout).toBe(300);
  });

  it("computes hedged profit against ALL stakes, not just the winning one (FR-8/FR-9)", () => {
    const threeWay: MarketRow = {
      ...resolvedMarket,
      id: "m-3",
      winning_outcome_id: "o-c",
      outcomes: [
        { id: "o-a", label: "Alpha", sort_order: 0, pool: 300 },
        { id: "o-b", label: "Beta", sort_order: 1, pool: 200 },
        { id: "o-c", label: "Gamma", sort_order: 2, pool: 250 },
      ],
    };
    // Hedged: 60 on the winner, 100 on a loser - total stake 160.
    const bets: BetRow[] = [
      bet({ market_id: "m-3", outcome_id: "o-c", amount: 60, price_at_bet: 33 }),
      bet({ id: "b-hedge", market_id: "m-3", outcome_id: "o-a", amount: 100, price_at_bet: 40 }),
    ];
    const payouts: PayoutRow[] = [
      { market_id: "m-3", type: "bet_payout", amount: 140 },
    ];

    const rows = aggregateResolved(bets, [threeWay], payouts);
    expect(rows[0]).toMatchObject({ stake: 160, payout: 140, pnl: -20, won: true });
    // Estimate derives only from winning-outcome bets: round(60*100/33) = 182.
    expect(rows[0].estimatedPayout).toBe(182);
  });

  it("has no estimated payout for lost or voided positions", () => {
    const lost: BetRow[] = [
      bet({ market_id: "m-res", outcome_id: "o-no", amount: 50, price_at_bet: 45 }),
    ];
    expect(aggregateResolved(lost, [resolvedMarket], [])[0].estimatedPayout).toBeNull();

    const voided: MarketRow = {
      ...resolvedMarket,
      id: "m-void",
      status: "voided",
      winning_outcome_id: null,
    };
    const refunded: BetRow[] = [
      bet({ market_id: "m-void", amount: 50, price_at_bet: 45 }),
    ];
    expect(
      aggregateResolved(refunded, [voided], [
        { market_id: "m-void", type: "market_refund", amount: 50 },
      ])[0].estimatedPayout,
    ).toBeNull();
  });

  it("returns empty rows for an empty portfolio", () => {
    expect(aggregateResolved([], [], [])).toEqual([]);
    expect(aggregateOpenPositions([], [])).toEqual([]);
  });

  it("treats a voided market refund as zero P&L", () => {
    const voided: MarketRow = {
      ...resolvedMarket,
      id: "m-void",
      status: "voided",
      winning_outcome_id: null,
    };
    const bets: BetRow[] = [
      bet({ market_id: "m-void", outcome_id: "o-no", amount: 80, price_at_bet: 40 }),
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
      outcomeLabel: "Void",
    });
  });

  it("records a full stake loss when another outcome won", () => {
    const bets: BetRow[] = [
      bet({ market_id: "m-res", outcome_id: "o-no", amount: 50, price_at_bet: 45 }),
    ];
    const rows = aggregateResolved(bets, [resolvedMarket], []);
    expect(rows[0]).toMatchObject({
      stake: 50,
      payout: 0,
      pnl: -50,
      won: false,
    });
  });

  it("detects wins by outcome identity on 3+-outcome markets (FR-19)", () => {
    const threeWay: MarketRow = {
      ...resolvedMarket,
      id: "m-3",
      winning_outcome_id: "o-c",
      outcomes: [
        { id: "o-a", label: "Alpha", sort_order: 0, pool: 300 },
        { id: "o-b", label: "Beta", sort_order: 1, pool: 200 },
        { id: "o-c", label: "Gamma", sort_order: 2, pool: 250 },
      ],
    };
    const bets: BetRow[] = [
      bet({ market_id: "m-3", outcome_id: "o-c", amount: 40 }),
    ];
    const payouts: PayoutRow[] = [
      { market_id: "m-3", type: "bet_payout", amount: 90 },
    ];

    const rows = aggregateResolved(bets, [threeWay], payouts);
    expect(rows[0]).toMatchObject({ outcomeLabel: "Gamma", won: true, payout: 90 });
  });

  it("picks the best-call winning bet as shareBetId (lowest price, earliest first)", () => {
    const bets: BetRow[] = [
      bet({ id: "b-late", market_id: "m-res", outcome_id: "o-yes", price_at_bet: 40, created_at: "2026-07-01T12:00:00Z" }),
      bet({ id: "b-best", market_id: "m-res", outcome_id: "o-yes", amount: 50, price_at_bet: 22, created_at: "2026-07-01T13:00:00Z" }),
      bet({ id: "b-tie-first", market_id: "m-res", outcome_id: "o-yes", amount: 10, price_at_bet: 22, created_at: "2026-07-01T11:00:00Z" }),
      bet({ id: "b-losing", market_id: "m-res", outcome_id: "o-no", amount: 10, price_at_bet: 5, created_at: "2026-07-01T09:00:00Z" }),
    ];
    const payouts: PayoutRow[] = [
      { market_id: "m-res", type: "bet_payout", amount: 200 },
    ];
    const rows = aggregateResolved(bets, [resolvedMarket], payouts);
    expect(rows[0].won).toBe(true);
    // tie on 22¢ goes to the earlier bet
    expect(rows[0].shareBetId).toBe("b-tie-first");
  });

  it("has no shareBetId for lost or voided positions", () => {
    const lost: BetRow[] = [
      bet({ id: "b-lost", market_id: "m-res", outcome_id: "o-no", amount: 50, price_at_bet: 45 }),
    ];
    expect(aggregateResolved(lost, [resolvedMarket], [])[0].shareBetId).toBeNull();

    const voided: MarketRow = {
      ...resolvedMarket,
      id: "m-void",
      status: "voided",
      winning_outcome_id: null,
    };
    const refunded: BetRow[] = [
      bet({ id: "b-void", market_id: "m-void", amount: 50, price_at_bet: 45 }),
    ];
    expect(
      aggregateResolved(refunded, [voided], [
        { market_id: "m-void", type: "market_refund", amount: 50 },
      ])[0].shareBetId,
    ).toBeNull();
  });
});

// ── aggregateBetHistory ───────────────────────────────────────────────────

describe("aggregateBetHistory", () => {
  it("returns one row per bet with market title and outcome label", () => {
    const bets: BetRow[] = [
      bet({ outcome_id: "o-yes", amount: 100, price_at_bet: 50, created_at: "2026-07-10T10:00:00Z" }),
      bet({ id: "b-2", outcome_id: "o-no", amount: 50, price_at_bet: 40, created_at: "2026-07-09T08:00:00Z" }),
    ];

    const history = aggregateBetHistory(bets, [openMarket]);

    expect(history).toHaveLength(2);
    // Sorted newest-first
    expect(history[0].betId).toBe("b-id");
    expect(history[0].outcomeLabel).toBe("Yes");
    expect(history[0].amount).toBe(100);
    expect(history[0].priceAtBet).toBe(50);
    expect(history[0].marketTitle).toBe("Will the Green Line delay?");
    expect(history[0].marketStatus).toBe("open");
    expect(history[1].outcomeLabel).toBe("No");
  });

  it("sorts bets newest-first across markets", () => {
    const bets: BetRow[] = [
      bet({ id: "b-old", market_id: "m-open", outcome_id: "o-yes", created_at: "2026-07-08T00:00:00Z" }),
      bet({ id: "b-new", market_id: "m-res", outcome_id: "o-yes", created_at: "2026-07-12T00:00:00Z" }),
    ];

    const history = aggregateBetHistory(bets, [openMarket, resolvedMarket]);

    expect(history[0].betId).toBe("b-new");
    expect(history[1].betId).toBe("b-old");
  });

  it("includes the market status so the UI can show settled state", () => {
    const bets: BetRow[] = [bet({ market_id: "m-res", outcome_id: "o-yes" })];

    const history = aggregateBetHistory(bets, [resolvedMarket]);

    expect(history[0].marketStatus).toBe("resolved");
  });

  it("ignores bets for unknown markets (data integrity guard)", () => {
    const bets: BetRow[] = [bet({ market_id: "unknown" })];
    expect(aggregateBetHistory(bets, [])).toHaveLength(0);
  });

  it("returns empty array for empty inputs", () => {
    expect(aggregateBetHistory([], [])).toEqual([]);
  });
});

// ── getUserCreatedMarkets ─────────────────────────────────────────────────

describe("getUserCreatedMarkets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches markets for the given user and shapes them correctly", async () => {
    const marketsBuilder = chainable({
      data: [
        {
          id: "m-1",
          title: "Will it snow?",
          status: "open",
          category: "weather",
          created_at: "2026-07-10T10:00:00Z",
          close_at: "2026-07-20T20:00:00Z",
        },
      ],
      error: null,
    });
    from.mockReturnValue(marketsBuilder);

    const result = await getUserCreatedMarkets("user-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "m-1",
      title: "Will it snow?",
      status: "open",
      category: "weather",
      createdAt: "2026-07-10T10:00:00Z",
      closeAt: "2026-07-20T20:00:00Z",
    });
    expect(from).toHaveBeenCalledWith("markets");
    const b = marketsBuilder;
    expect(b.select).toHaveBeenCalled();
    expect(b.eq).toHaveBeenCalledWith("creator_id", "user-1");
    expect(b.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns an empty array when the user has no created markets", async () => {
    const marketsBuilder = chainable({ data: [], error: null });
    from.mockReturnValue(marketsBuilder);

    const result = await getUserCreatedMarkets("user-2");

    expect(result).toEqual([]);
  });
});
