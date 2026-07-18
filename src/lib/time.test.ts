import { describe, expect, it } from "vitest";
import { etDayKey } from "./time";

describe("etDayKey", () => {
  it("returns the ET calendar date for a UTC afternoon instant", () => {
    expect(etDayKey(new Date("2026-07-18T18:00:00Z"))).toBe("2026-07-18");
  });

  it("rolls back to the previous ET day just after UTC midnight in summer (EDT, UTC-4)", () => {
    expect(etDayKey(new Date("2026-07-18T02:00:00Z"))).toBe("2026-07-17");
  });

  it("rolls back to the previous ET day before 05:00 UTC in winter (EST, UTC-5)", () => {
    expect(etDayKey(new Date("2026-01-15T04:59:00Z"))).toBe("2026-01-14");
  });

  it("flips to the new ET day at exactly 05:00 UTC in winter", () => {
    expect(etDayKey(new Date("2026-01-15T05:00:00Z"))).toBe("2026-01-15");
  });

  it("zero-pads single-digit months and days", () => {
    expect(etDayKey(new Date("2026-03-05T12:00:00Z"))).toBe("2026-03-05");
  });
});
