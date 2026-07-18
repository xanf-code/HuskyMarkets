import { describe, expect, it } from "vitest";
import { getAuthRedirect } from "./auth";

describe("getAuthRedirect", () => {
  describe("unauthenticated", () => {
    it("redirects the home page to /login", () => {
      expect(getAuthRedirect("/", false)).toBe("/login");
    });

    it("redirects an app page to /login", () => {
      expect(getAuthRedirect("/portfolio", false)).toBe("/login");
    });

    it("allows /login", () => {
      expect(getAuthRedirect("/login", false)).toBeNull();
    });

    it("allows /tos", () => {
      expect(getAuthRedirect("/tos", false)).toBeNull();
    });

    it("allows shared bet pages", () => {
      expect(getAuthRedirect("/share/bet/abc-123", false)).toBeNull();
    });

    it("allows OG image endpoints", () => {
      expect(getAuthRedirect("/api/og/market/abc-123", false)).toBeNull();
    });

    it("does not treat /loginfoo as public", () => {
      expect(getAuthRedirect("/loginfoo", false)).toBe("/login");
    });

    it("does not treat a bare /share as public", () => {
      expect(getAuthRedirect("/share", false)).toBe("/login");
    });

    it("does not treat a bare /api/og as public", () => {
      expect(getAuthRedirect("/api/og", false)).toBe("/login");
    });
  });

  describe("authenticated", () => {
    it("allows the home page", () => {
      expect(getAuthRedirect("/", true)).toBeNull();
    });

    it("allows an app page", () => {
      expect(getAuthRedirect("/portfolio", true)).toBeNull();
    });
  });
});
