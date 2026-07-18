import { describe, expect, it } from "vitest";
import { getAuthRedirect } from "./auth";

describe("getAuthRedirect", () => {
  describe("unauthenticated", () => {
    it("redirects the home page to /login", () => {
      expect(getAuthRedirect("/", false, false)).toBe("/login");
    });

    it("redirects an app page to /login", () => {
      expect(getAuthRedirect("/portfolio", false, false)).toBe("/login");
    });

    it("redirects /onboarding to /login", () => {
      expect(getAuthRedirect("/onboarding", false, false)).toBe("/login");
    });

    it("allows /login", () => {
      expect(getAuthRedirect("/login", false, false)).toBeNull();
    });

    it("allows /tos", () => {
      expect(getAuthRedirect("/tos", false, false)).toBeNull();
    });

    it("allows shared bet pages", () => {
      expect(getAuthRedirect("/share/bet/abc-123", false, false)).toBeNull();
    });

    it("allows OG image endpoints", () => {
      expect(getAuthRedirect("/api/og/market/abc-123", false, false)).toBeNull();
    });

    it("allows the auth callback so the magic-link code can be exchanged", () => {
      expect(getAuthRedirect("/auth/callback", false, false)).toBeNull();
    });

    it("does not treat /loginfoo as public", () => {
      expect(getAuthRedirect("/loginfoo", false, false)).toBe("/login");
    });

    it("does not treat a bare /share as public", () => {
      expect(getAuthRedirect("/share", false, false)).toBe("/login");
    });

    it("does not treat a bare /api/og as public", () => {
      expect(getAuthRedirect("/api/og", false, false)).toBe("/login");
    });

    it("does not treat a bare /auth as public", () => {
      expect(getAuthRedirect("/auth", false, false)).toBe("/login");
    });

    it("does not treat /authfoo as public", () => {
      expect(getAuthRedirect("/authfoo", false, false)).toBe("/login");
    });
  });

  describe("authenticated but not onboarded", () => {
    it("redirects the home page to /onboarding", () => {
      expect(getAuthRedirect("/", true, false)).toBe("/onboarding");
    });

    it("redirects an app page to /onboarding", () => {
      expect(getAuthRedirect("/portfolio", true, false)).toBe("/onboarding");
    });

    it("allows /onboarding itself", () => {
      expect(getAuthRedirect("/onboarding", true, false)).toBeNull();
    });

    it("allows /tos so the terms can be read mid-onboarding", () => {
      expect(getAuthRedirect("/tos", true, false)).toBeNull();
    });

    it("allows public prefixes such as shared bet pages", () => {
      expect(getAuthRedirect("/share/bet/abc-123", true, false)).toBeNull();
    });
  });

  describe("authenticated and onboarded", () => {
    it("allows the home page", () => {
      expect(getAuthRedirect("/", true, true)).toBeNull();
    });

    it("allows an app page", () => {
      expect(getAuthRedirect("/portfolio", true, true)).toBeNull();
    });

    it("bounces /onboarding back to the home page", () => {
      expect(getAuthRedirect("/onboarding", true, true)).toBe("/");
    });
  });
});
