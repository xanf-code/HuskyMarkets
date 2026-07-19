import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatCountdown,
  formatHC,
  marketVolume,
  timeAgo,
} from "./format";

describe("formatHC", () => {
  it("adds thousands separators and the HC suffix", () => {
    expect(formatHC(1000)).toBe("1,000 HC");
    expect(formatHC(50)).toBe("50 HC");
    expect(formatHC(0)).toBe("0 HC");
  });
});

describe("formatCents", () => {
  it("renders an implied price as cents", () => {
    expect(formatCents(63)).toBe("63¢");
    expect(formatCents(1)).toBe("1¢");
  });
});

describe("marketVolume", () => {
  it("is the pools minus the 200 HC house seed", () => {
    expect(marketVolume(450, 300)).toBe(550);
    expect(marketVolume(100, 100)).toBe(0);
  });

  it("never goes negative", () => {
    expect(marketVolume(90, 90)).toBe(0);
  });
});

describe("formatCountdown", () => {
  const now = new Date("2026-07-18T12:00:00Z");

  it("shows days and hours when more than a day out", () => {
    expect(formatCountdown(new Date("2026-07-20T15:30:00Z"), now)).toBe(
      "2d 3h",
    );
  });

  it("shows hours and minutes within a day", () => {
    expect(formatCountdown(new Date("2026-07-18T15:12:00Z"), now)).toBe(
      "3h 12m",
    );
  });

  it("shows minutes within an hour", () => {
    expect(formatCountdown(new Date("2026-07-18T12:42:00Z"), now)).toBe("42m");
  });

  it("shows <1m in the final minute", () => {
    expect(formatCountdown(new Date("2026-07-18T12:00:30Z"), now)).toBe("<1m");
  });

  it("shows 'closed' once the moment has passed", () => {
    expect(formatCountdown(new Date("2026-07-18T11:59:00Z"), now)).toBe(
      "closed",
    );
  });

  it("accepts ISO strings", () => {
    expect(formatCountdown("2026-07-18T15:12:00Z", now)).toBe("3h 12m");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-07-18T12:00:00Z");

  it("renders seconds as 'just now'", () => {
    expect(timeAgo(new Date("2026-07-18T11:59:40Z"), now)).toBe("just now");
  });

  it("renders minutes, hours, and days", () => {
    expect(timeAgo(new Date("2026-07-18T11:58:00Z"), now)).toBe("2m ago");
    expect(timeAgo(new Date("2026-07-18T09:00:00Z"), now)).toBe("3h ago");
    expect(timeAgo(new Date("2026-07-15T12:00:00Z"), now)).toBe("3d ago");
  });
});
