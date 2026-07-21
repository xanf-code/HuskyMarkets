import { describe, expect, it } from "vitest";
import { isNeuEmail, safeReturnPath } from "./auth";

describe("isNeuEmail", () => {
  it("accepts a northeastern.edu address", () => {
    expect(isNeuEmail("husky@northeastern.edu")).toBe(true);
  });

  it("accepts uppercase domain letters", () => {
    expect(isNeuEmail("Husky@Northeastern.EDU")).toBe(true);
  });

  it("accepts addresses with surrounding whitespace", () => {
    expect(isNeuEmail("  husky@northeastern.edu  ")).toBe(true);
  });

  it("rejects a non-NEU domain", () => {
    expect(isNeuEmail("husky@gmail.com")).toBe(false);
  });

  it("rejects northeastern.edu as a subdomain prefix of an evil domain", () => {
    expect(isNeuEmail("husky@northeastern.edu.evil.com")).toBe(false);
  });

  it("rejects other .edu domains", () => {
    expect(isNeuEmail("husky@neu.edu")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isNeuEmail("")).toBe(false);
  });

  it("rejects a string with no local part", () => {
    expect(isNeuEmail("@northeastern.edu")).toBe(false);
  });
});

describe("safeReturnPath", () => {
  it("accepts an in-app path", () => {
    expect(safeReturnPath("/market/abc-123")).toBe("/market/abc-123");
  });

  it("accepts a path with a query string", () => {
    expect(safeReturnPath("/?category=sports")).toBe("/?category=sports");
  });

  it("rejects protocol-relative URLs (open redirect)", () => {
    expect(safeReturnPath("//evil.com")).toBeNull();
  });

  it("rejects absolute URLs", () => {
    expect(safeReturnPath("https://evil.com")).toBeNull();
  });

  it("rejects bare strings", () => {
    expect(safeReturnPath("market/abc")).toBeNull();
  });

  it("rejects null and empty input", () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath("")).toBeNull();
  });

  it("rejects backslash-prefixed paths (open redirect via /\\evil.com)", () => {
    expect(safeReturnPath("/\\evil.com")).toBeNull();
    expect(safeReturnPath("/\\\\evil.com")).toBeNull();
  });
});
