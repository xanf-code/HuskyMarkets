import { describe, expect, it } from "vitest";
import { filterConflictMarkets } from "./admin";

describe("filterConflictMarkets", () => {
  const items = [
    { id: "m1", creatorId: "alice", title: "A" },
    { id: "m2", creatorId: "bob", title: "B" },
    { id: "m3", creatorId: "carol", title: "C" },
  ];

  it("returns all items when no exclude user", () => {
    expect(filterConflictMarkets(items, undefined, new Set(["m2"]))).toEqual(
      items,
    );
  });

  it("drops markets the mod created or bet on", () => {
    expect(
      filterConflictMarkets(items, "alice", new Set(["m3"])).map((m) => m.id),
    ).toEqual(["m2"]);
  });
});
