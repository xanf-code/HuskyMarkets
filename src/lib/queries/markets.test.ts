import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterAndSortMarkets,
  groupSparklines,
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
    bettorCount: 0,
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
    return builder;
  }

  it("fetches markets with embedded outcomes in one query and shapes list items", async () => {
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
    const marketsBuilder = chainable({ data: [], error: null });
    from.mockImplementation(() => marketsBuilder);

    const list = await getMarketList({});

    expect(list).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
