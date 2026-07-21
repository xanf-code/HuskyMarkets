import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterAndSortMarkets,
  groupSparklines,
  getMarketDetail,
  getMarketList,
  type MarketListItem,
} from "./markets";

const { from, getSession, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({ getSession }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from, rpc }),
}));

const YES = { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 };
const NO = { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 };

function item(overrides: Partial<MarketListItem>): MarketListItem {
  return {
    id: "m1",
    title: "Will it snow before finals?",
    category: "weather",
    closeAt: "2026-07-20T00:00:00Z",
    createdAt: "2026-07-10T00:00:00Z",
    outcomes: [YES, NO],
    volume: 100,
    bettorCount: 2,
    spark: [50, 67],
    ...overrides,
  };
}

describe("filterAndSortMarkets", () => {
  const markets = [
    item({ id: "a", title: "Snow day before finals", category: "weather", closeAt: "2026-07-21T00:00:00Z", volume: 500, createdAt: "2026-07-01T00:00:00Z" }),
    item({ id: "b", title: "Green Line delayed again", category: "transit", closeAt: "2026-07-19T00:00:00Z", volume: 100, createdAt: "2026-07-03T00:00:00Z" }),
    item({ id: "c", title: "Hockey playoffs run", category: "sports", closeAt: "2026-07-25T00:00:00Z", volume: 300, createdAt: "2026-07-02T00:00:00Z" }),
  ];

  it("defaults to closing-soon order", () => {
    expect(filterAndSortMarkets(markets, {}).map((m) => m.id)).toEqual([
      "b", "a", "c",
    ]);
  });

  it("sorts by volume descending", () => {
    expect(
      filterAndSortMarkets(markets, { sort: "volume" }).map((m) => m.id),
    ).toEqual(["a", "c", "b"]);
  });

  it("sorts by newest first", () => {
    expect(
      filterAndSortMarkets(markets, { sort: "newest" }).map((m) => m.id),
    ).toEqual(["b", "c", "a"]);
  });

  it("filters by category", () => {
    expect(
      filterAndSortMarkets(markets, { category: "transit" }).map((m) => m.id),
    ).toEqual(["b"]);
  });

  it("searches titles case-insensitively", () => {
    expect(
      filterAndSortMarkets(markets, { q: "green line" }).map((m) => m.id),
    ).toEqual(["b"]);
  });
});

describe("groupSparklines", () => {
  it("keeps up to N most-recent points per market+outcome in chronological order", () => {
    // rows arrive newest-first, as fetched
    const rows = [
      { market_id: "a", outcome_id: "o1", implied: 70 },
      { market_id: "a", outcome_id: "o2", implied: 30 },
      { market_id: "a", outcome_id: "o1", implied: 60 },
      { market_id: "a", outcome_id: "o1", implied: 50 },
    ];
    const grouped = groupSparklines(rows, 2);
    expect(grouped.get("a:o1")).toEqual([60, 70]);
    expect(grouped.get("a:o2")).toEqual([30]);
  });
});

describe("getMarketList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const selectSpy = vi.fn();

  function chainable(result: { data: unknown; error: null }) {
    const builder: Record<string, unknown> = {};
    for (const method of ["eq", "in", "order", "limit"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.select = vi.fn((arg: string) => {
      selectSpy(arg);
      return builder;
    });
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve);
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    return builder;
  }

  it("skips the bets query and returns bettorCount: null for guests", async () => {
    getSession.mockResolvedValue(null);
    const marketsBuilder = chainable({
      data: [
        {
          id: "m1",
          title: "Will it snow before finals?",
          category: "weather",
          close_at: "2026-07-20T00:00:00Z",
          created_at: "2026-07-10T00:00:00Z",
          market_outcomes: [
            { id: "o-yes", label: "Yes", sort_order: 0, pool: 200 },
            { id: "o-no", label: "No", sort_order: 1, pool: 100 },
          ],
        },
      ],
      error: null,
    });
    const historyBuilder = chainable({ data: [], error: null });
    from.mockImplementation((table: string) => {
      if (table === "markets") return marketsBuilder;
      return historyBuilder;
    });

    const list = await getMarketList({});

    expect(list[0].bettorCount).toBeNull();
    expect(from).not.toHaveBeenCalledWith("bets");
  });

  it("fetches markets with embedded outcomes in one query and shapes list items", async () => {
    getSession.mockResolvedValue({ userId: "u1", email: null });
    const marketsBuilder = chainable({
      data: [
        {
          id: "m1",
          title: "Will it snow before finals?",
          category: "weather",
          close_at: "2026-07-20T00:00:00Z",
          created_at: "2026-07-10T00:00:00Z",
          market_outcomes: [
            { id: "o-no", label: "No", sort_order: 1, pool: 100 },
            { id: "o-yes", label: "Yes", sort_order: 0, pool: 200 },
          ],
        },
      ],
      error: null,
    });
    const historyBuilder = chainable({
      data: [
        { market_id: "m1", outcome_id: "o-yes", implied: 67 },
        { market_id: "m1", outcome_id: "o-no", implied: 33 },
        { market_id: "m1", outcome_id: "o-yes", implied: 50 },
      ],
      error: null,
    });
    const betsBuilder = chainable({
      data: [
        { market_id: "m1", user_id: "u1" },
        { market_id: "m1", user_id: "u2" },
        { market_id: "m1", user_id: "u1" },
      ],
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === "markets") return marketsBuilder;
      if (table === "bets") return betsBuilder;
      return historyBuilder;
    });

    const list = await getMarketList({});

    // Outcomes ride the markets query as an embedded resource — one round
    // trip, no N+1 (REC-19) — and come out in canonical sort_order.
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining("market_outcomes"),
    );
    expect(list).toEqual([
      {
        id: "m1",
        title: "Will it snow before finals?",
        category: "weather",
        closeAt: "2026-07-20T00:00:00Z",
        createdAt: "2026-07-10T00:00:00Z",
        outcomes: [
          { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
          { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 },
        ],
        volume: 100,
        bettorCount: 2,
        spark: [50, 67],
      },
    ]);
  });

  it("returns an empty list without fetching history when no markets are open", async () => {
    getSession.mockResolvedValue({ userId: "u1", email: null });
    const marketsBuilder = chainable({ data: [], error: null });
    from.mockImplementation(() => marketsBuilder);

    const list = await getMarketList({});

    expect(list).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("getMarketDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const MARKET_ROW = {
    id: "m1",
    title: "Will it snow before finals?",
    category: "weather",
    status: "open",
    close_at: "2026-07-20T00:00:00Z",
    resolve_at: "2026-07-21T00:00:00Z",
    created_at: "2026-07-10T00:00:00Z",
    creator_id: "u-creator",
    winning_outcome_id: null,
    hidden: false,
    resolution_criteria: "Snow on the ground.",
    description: null,
    market_outcomes: [
      { id: "o-yes", label: "Yes", sort_order: 0, pool: 200 },
      { id: "o-no", label: "No", sort_order: 1, pool: 100 },
    ],
  };

  function detailBuilder(result: { data: unknown; error: null }) {
    const builder: Record<string, unknown> = {};
    for (const method of ["eq", "in", "order", "limit"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.select = vi.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve);
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    return builder;
  }

  function mockDetailQueries({
    session,
    bets = [],
    balance = 0,
  }: {
    session: { userId: string; email: string | null } | null;
    bets?: unknown[];
    balance?: number;
  }) {
    from.mockImplementation((table: string) => {
      if (table === "markets") {
        return detailBuilder({ data: MARKET_ROW, error: null });
      }
      if (table === "bets") {
        return detailBuilder({ data: bets, error: null });
      }
      if (table === "public_profiles") {
        return detailBuilder({
          data: { display_name: "SnowHusky" },
          error: null,
        });
      }
      return detailBuilder({ data: [], error: null });
    });
    getSession.mockResolvedValue(session);
    rpc.mockResolvedValue({ data: balance, error: null });
  }

  it("locks activity, position and balance for guests without querying bets", async () => {
    mockDetailQueries({ session: null });

    const detail = await getMarketDetail("m1");

    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({
      isGuest: true,
      activity: [],
      position: [],
      balance: 0,
      bettorCount: null,
      creatorName: "SnowHusky",
    });
    // No bets query and no balance RPC for guests: locked content is locked
    // server-side, never shipped and hidden visually.
    expect(from).not.toHaveBeenCalledWith("bets");
    expect(rpc).not.toHaveBeenCalled();
    // Market, outcomes and price history still load for guest browsing.
    expect(from).toHaveBeenCalledWith("markets");
    expect(from).toHaveBeenCalledWith("price_history");
    expect(detail!.outcomes).toHaveLength(2);
  });

  it("returns activity, position and balance for signed-in users", async () => {
    mockDetailQueries({
      session: { userId: "u1", email: null },
      bets: [
        {
          id: "b1",
          user_id: "u1",
          outcome_id: "o-yes",
          amount: 50,
          price_at_bet: 67,
          created_at: "2026-07-15T00:00:00Z",
        },
        {
          id: "b2",
          user_id: "u2",
          outcome_id: "o-no",
          amount: 25,
          price_at_bet: 33,
          created_at: "2026-07-14T00:00:00Z",
        },
      ],
      balance: 400,
    });

    const detail = await getMarketDetail("m1");

    expect(detail).toMatchObject({ isGuest: false, bettorCount: 2, balance: 400 });
    expect(detail!.activity).toHaveLength(2);
    expect(detail!.position).toEqual([
      { outcomeId: "o-yes", label: "Yes", stake: 50 },
    ]);
  });
});
