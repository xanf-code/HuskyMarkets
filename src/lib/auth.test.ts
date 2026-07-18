import { describe, expect, it } from "vitest";
import { isNeuEmail } from "./auth";

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
