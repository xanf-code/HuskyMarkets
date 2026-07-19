import { describe, expect, it } from "vitest";
import { theme } from "./theme";

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
