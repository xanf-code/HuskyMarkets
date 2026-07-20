import { describe, expect, it } from "vitest";
import {
  leadingOutcome,
  outcomeStateFromRpc,
  sortByOutcomeOrder,
  totalPool,
  type OutcomeState,
} from "./outcomes";

const outcome = (overrides: Partial<OutcomeState>): OutcomeState => ({
  id: "o1",
  label: "Yes",
  sortOrder: 0,
  pool: 100,
  implied: 50,
  ...overrides,
});

describe("sortByOutcomeOrder", () => {
  it("orders by sort_order ascending without mutating the input", () => {
    const shuffled = [
      outcome({ id: "c", sortOrder: 2 }),
      outcome({ id: "a", sortOrder: 0 }),
      outcome({ id: "b", sortOrder: 1 }),
    ];

    const sorted = sortByOutcomeOrder(shuffled);

    expect(sorted.map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(shuffled[0].id).toBe("c");
  });
});

describe("totalPool", () => {
  it("sums every outcome pool", () => {
    expect(
      totalPool([outcome({ pool: 200 }), outcome({ pool: 150 }), outcome({ pool: 100 })]),
    ).toBe(450);
    expect(totalPool([])).toBe(0);
  });
});

describe("leadingOutcome", () => {
  it("is the outcome with the highest pool (A-2)", () => {
    const outcomes = [
      outcome({ id: "a", pool: 100, sortOrder: 0 }),
      outcome({ id: "b", pool: 400, sortOrder: 1 }),
      outcome({ id: "c", pool: 250, sortOrder: 2 }),
    ];

    expect(leadingOutcome(outcomes)?.id).toBe("b");
  });

  it("breaks ties by lowest sort_order so the leader never flaps on equal pools", () => {
    const outcomes = [
      outcome({ id: "b", pool: 100, sortOrder: 1 }),
      outcome({ id: "a", pool: 100, sortOrder: 0 }),
    ];

    expect(leadingOutcome(outcomes)?.id).toBe("a");
  });

  it("returns null for an empty outcome list", () => {
    expect(leadingOutcome([])).toBeNull();
  });
});

describe("outcomeStateFromRpc", () => {
  it("maps the _outcome_map jsonb payload and orders by sort_order", () => {
    const json = [
      { id: "o2", label: "No", sort_order: 1, pool: 100, implied: 33 },
      { id: "o1", label: "Yes", sort_order: 0, pool: 200, implied: 67 },
    ];

    expect(outcomeStateFromRpc(json)).toEqual([
      { id: "o1", label: "Yes", sortOrder: 0, pool: 200, implied: 67 },
      { id: "o2", label: "No", sortOrder: 1, pool: 100, implied: 33 },
    ]);
  });

  it("treats null/non-array payloads as an empty map", () => {
    expect(outcomeStateFromRpc(null)).toEqual([]);
    expect(outcomeStateFromRpc("boom")).toEqual([]);
  });
});
