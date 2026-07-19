import { describe, expect, it } from "vitest";
import {
  ONBOARDED_COOKIE,
  ONBOARDED_COOKIE_OPTIONS,
  decideOnboardedCookie,
  type OnboardedDecision,
} from "./onboarded-cookie";

describe("ONBOARDED_COOKIE constants", () => {
  it("is a presence-based stamp with safe cookie options", () => {
    expect(ONBOARDED_COOKIE).toBe("hm-onboarded");
    expect(ONBOARDED_COOKIE_OPTIONS).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  });
});

describe("decideOnboardedCookie", () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof decideOnboardedCookie>[0];
    expected: OnboardedDecision;
  }> = [
    {
      name: "unauthenticated visitor with a stale stamp is cleaned up",
      input: { isAuthenticated: false, hasCookie: true },
      expected: "clear",
    },
    {
      name: "unauthenticated visitor without a stamp is left alone",
      input: { isAuthenticated: false, hasCookie: false },
      expected: "keep",
    },
    {
      name: "authenticated visitor already stamped is left alone",
      input: { isAuthenticated: true, hasCookie: true },
      expected: "keep",
    },
    {
      name: "authenticated, unstamped, onboarded in db → backfill the stamp",
      input: { isAuthenticated: true, hasCookie: false, dbOnboarded: true },
      expected: "set",
    },
    {
      name: "authenticated, unstamped, not onboarded in db → never write '0'",
      input: { isAuthenticated: true, hasCookie: false, dbOnboarded: false },
      expected: "keep",
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(decideOnboardedCookie(input)).toBe(expected);
    });
  }
});
