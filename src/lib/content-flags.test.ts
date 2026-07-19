import { describe, expect, it } from "vitest";
import { flagContent } from "./content-flags";

describe("flagContent", () => {
  it("allows an ordinary campus market", () => {
    expect(
      flagContent(
        "Will it snow in Boston before Thanksgiving break?",
        "First measurable snowfall.",
        "Resolves YES if NWS Boston records 0.1in of snow before Nov 26.",
      ),
    ).toEqual({ blocked: false, flagged: false });
  });

  it("flags a sensitive verb aimed at what looks like a person's name", () => {
    expect(
      flagContent(
        "Will Jake Thompson hook up with anyone at the formal?",
        "",
        "Resolves YES if confirmed by two witnesses at the event.",
      ),
    ).toEqual({ blocked: false, flagged: true });
  });

  it("flags targeting in the description or criteria, not just the title", () => {
    expect(
      flagContent(
        "Big drama incoming this semester?",
        "Everyone knows Sarah Mitchell might get expelled soon.",
        "Resolves YES if the university confirms the outcome publicly.",
      ),
    ).toEqual({ blocked: false, flagged: true });
  });

  it("does not flag a sensitive verb without a person-like name", () => {
    expect(
      flagContent(
        "Will anyone get expelled from the dorms this semester?",
        "",
        "Resolves YES on any official housing expulsion notice this semester.",
      ),
    ).toEqual({ blocked: false, flagged: false });
  });

  it("does not flag a person-like name without a sensitive verb", () => {
    expect(
      flagContent(
        "Will Jane Doe win the student government election?",
        "",
        "Resolves YES if she is announced as the winner by SGA.",
      ),
    ).toEqual({ blocked: false, flagged: false });
  });

  it("does not flag allowlisted campus places next to sensitive verbs", () => {
    expect(
      flagContent(
        "Will the Green Line dump passengers at Copley again this week?",
        "Snell Library date night crowds don't count.",
        "Resolves YES on any MBTA shuttle-replacement alert for the E branch.",
      ),
    ).toEqual({ blocked: false, flagged: false });
  });

  it("hard-blocks slurs regardless of anything else", () => {
    const result = flagContent(
      "Will the retard in my physics lecture fail the midterm?",
      "",
      "Resolves YES based on posted grades.",
    );
    expect(result.blocked).toBe(true);
  });
});
