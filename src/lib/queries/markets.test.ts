import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterAndSortMarkets,
  groupSparklines,
  getMarketList,
  type MarketListItem,
} from "./markets";

const { from, getUser, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from, auth: { getUser }, rpc }),
}));

function item(overrides: Partial<MarketListItem>): MarketListItem {
  return {
    id: "m1",
    title: "Will it snow before finals?",
    category: "weather",
    closeAt: "2026-07-20T00:00:00Z",
    createdAt: "2026-07-10T00:00:00Z",
    yesPool: 200,
    noPool: 100,
    impliedYes: 67,
    volume: 100,
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
  it("keeps up to N most-recent points per market in chronological order", () => {
    // rows arrive newest-first, as fetched
    const rows = [
      { market_id: "a", implied_yes: 70 },
      { market_id: "b", implied_yes: 40 },
      { market_id: "a", implied_yes: 60 },
      { market_id: "a", implied_yes: 50 },
    ];
    const grouped = groupSparklines(rows, 2);
    expect(grouped.get("a")).toEqual([60, 70]);
    expect(grouped.get("b")).toEqual([40]);
  });
});

describe("getMarketList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function chainable(result: { data: unknown; error: null }) {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve);
    return builder;
  }

  it("batches markets + sparkline points and shapes list items", async () => {
    const marketsBuilder = chainable({
      data: [
        {
          id: "m1",
          title: "Will it snow before finals?",
          category: "weather",
          close_at: "2026-07-20T00:00:00Z",
          created_at: "2026-07-10T00:00:00Z",
          yes_pool: 200,
          no_pool: 100,
        },
      ],
      error: null,
    });
    const historyBuilder = chainable({
      data: [
        { market_id: "m1", implied_yes: 67 },
        { market_id: "m1", implied_yes: 50 },
      ],
      error: null,
    });
    from.mockImplementation((table: string) =>
      table === "markets" ? marketsBuilder : historyBuilder,
    );

    const list = await getMarketList({});

    expect(list).toEqual([
      {
        id: "m1",
        title: "Will it snow before finals?",
        category: "weather",
        closeAt: "2026-07-20T00:00:00Z",
        createdAt: "2026-07-10T00:00:00Z",
        yesPool: 200,
        noPool: 100,
        impliedYes: 67,
        volume: 100,
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
