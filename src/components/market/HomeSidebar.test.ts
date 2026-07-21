import { describe, expect, it } from "vitest";
import { getTopMovers } from "./HomeSidebar";
import type { MarketListItem } from "@/lib/queries/markets";

const YES = { id: "o-yes", label: "Yes", sortOrder: 0, pool: 200, implied: 67 };
const NO = { id: "o-no", label: "No", sortOrder: 1, pool: 100, implied: 33 };

function item(id: string, change24h: number | null): MarketListItem {
  return {
    id,
    title: `Market ${id}`,
    category: "weather",
    closeAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-07-10T00:00:00Z",
    outcomes: [YES, NO],
    volume: 100,
    bettorCount: 2,
    spark: [50, 67],
    change24h,
  };
}

describe("getTopMovers", () => {
  it("ranks by abs(change24h) descending and returns up to 4", () => {
    const markets = [
      item("a", 5),
      item("b", -12),
      item("c", 3),
      item("d", 8),
      item("e", -15),
    ];
    const result = getTopMovers(markets);
    expect(result.map((r) => r.market.id)).toEqual(["e", "b", "d", "a"]);
    expect(result).toHaveLength(4);
  });

  it("excludes markets where change24h is null", () => {
    const markets = [item("a", null), item("b", 10)];
    const result = getTopMovers(markets);
    expect(result).toHaveLength(1);
    expect(result[0].market.id).toBe("b");
  });

  it("excludes markets where change24h is 0", () => {
    const markets = [item("a", 0), item("b", 5)];
    const result = getTopMovers(markets);
    expect(result).toHaveLength(1);
    expect(result[0].market.id).toBe("b");
  });

  it("returns empty array when all markets have null or zero change24h", () => {
    expect(getTopMovers([item("a", null), item("b", 0)])).toEqual([]);
  });

  it("exposes the delta from change24h on each row", () => {
    const markets = [item("a", 7.5), item("b", -3.2)];
    const result = getTopMovers(markets);
    expect(result[0].delta).toBeCloseTo(7.5);
    expect(result[1].delta).toBeCloseTo(-3.2);
  });
});
