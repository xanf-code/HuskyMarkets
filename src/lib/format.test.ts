import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  formatHC,
  formatHCNumber,
  formatPercent,
  marketVolume,
  timeAgo,
} from "./format";

describe("formatHCNumber", () => {
  it("adds thousands separators with no unit", () => {
    expect(formatHCNumber(1000)).toBe("1,000");
    expect(formatHCNumber(50)).toBe("50");
    expect(formatHCNumber(0)).toBe("0");
  });
});

describe("formatHC", () => {
  it("adds thousands separators and the HC suffix for plain strings", () => {
    expect(formatHC(1000)).toBe("1,000 HC");
    expect(formatHC(50)).toBe("50 HC");
    expect(formatHC(0)).toBe("0 HC");
  });
});

describe("formatPercent", () => {
  it("renders an implied probability as a percentage", () => {
    expect(formatPercent(62)).toBe("62%");
    expect(formatPercent(1)).toBe("1%");
  });
});

describe("marketVolume", () => {
  it("is the total pool minus the 100 HC per-outcome house seed", () => {
    expect(marketVolume(750, 2)).toBe(550);
    expect(marketVolume(450, 3)).toBe(150);
    expect(marketVolume(200, 2)).toBe(0);
  });

  it("never goes negative", () => {
    expect(marketVolume(180, 2)).toBe(0);
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
