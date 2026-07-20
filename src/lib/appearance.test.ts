import { describe, expect, it } from "vitest";
import { isAppearance } from "./appearance";

describe("isAppearance", () => {
  it("accepts light and dark", () => {
    expect(isAppearance("light")).toBe(true);
    expect(isAppearance("dark")).toBe(true);
  });

  it("rejects anything else, including undefined", () => {
    expect(isAppearance("system")).toBe(false);
    expect(isAppearance("")).toBe(false);
    expect(isAppearance(undefined)).toBe(false);
    expect(isAppearance(null)).toBe(false);
  });
});
