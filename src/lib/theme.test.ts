import { describe, expect, it } from "vitest";
import { outcomeColor, theme } from "./theme";

// WCAG relative luminance, used to document the palette's grayscale
// distinguishability contract (NFR-7).
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

describe("theme (Kalshi × NEU hybrid)", () => {
  it("uses a light product page surface, not pure black", () => {
    expect(theme.colors.page).toBe("#F5F6F8");
    expect(theme.colors.card).toBe("#FFFFFF");
    expect(theme.colors.muted).toBe("#EEF0F3");
  });

  it("keeps Northeastern red for brand chrome", () => {
    expect(theme.colors.red).toBe("#D41B2C");
    expect(theme.colors.redHover).toBe("#B01524");
    expect(theme.colors.redBright).toBe("#E31837");
  });

  it("separates market Yes/No semantics from brand red", () => {
    expect(theme.colors.marketYes).toBe("#00CE8E");
    expect(theme.colors.marketNo).toBe("#FF3B5C");
    expect(theme.colors.marketYes).not.toBe(theme.colors.red);
    expect(theme.colors.marketNo).not.toBe(theme.colors.red);
  });

  it("uses dark ink on light surfaces", () => {
    expect(theme.colors.text).toBe("#0A0A0A");
    expect(theme.colors.textMuted).toBe("#5C6370");
    expect(theme.colors.hairline).toBe("#E3E6EB");
  });

  it("exposes product radii (card 12, control 8, pill)", () => {
    expect(theme.radius.lg).toBe("12px");
    expect(theme.radius.md).toBe("8px");
    expect(theme.radius.pill).toBe("999px");
  });
});

describe("outcome palette (D-3, NFR-7)", () => {
  it("has exactly 6 tokens, one per possible outcome", () => {
    expect(theme.outcomePalette).toHaveLength(6);
  });

  it("reuses no color — every token is distinct", () => {
    expect(new Set(theme.outcomePalette).size).toBe(6);
  });

  it("keeps binary continuity: tokens 0/1 are the Yes/No hues", () => {
    expect(theme.outcomePalette[0]).toBe(theme.colors.marketYes);
    expect(theme.outcomePalette[1]).toBe(theme.colors.marketNo);
  });

  it("alternates light/dark luminance so neighbors stay grayscale-distinguishable", () => {
    const lums = theme.outcomePalette.map(luminance);
    for (let i = 1; i < lums.length; i++) {
      expect(Math.abs(lums[i] - lums[i - 1])).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("indexes by sort_order, wrapping past the palette length", () => {
    expect(outcomeColor(0)).toBe(theme.outcomePalette[0]);
    expect(outcomeColor(5)).toBe(theme.outcomePalette[5]);
    expect(outcomeColor(6)).toBe(theme.outcomePalette[0]);
  });
});
