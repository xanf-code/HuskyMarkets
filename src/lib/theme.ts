export const theme = {
  colors: {
    page: "#F5F6F8",
    card: "#FFFFFF",
    muted: "#EEF0F3",
    inverse: "#0B0F0E",
    ink: "#0A0A0A",
    red: "#D41B2C",
    redHover: "#B01524",
    redBright: "#E31837",
    text: "#0A0A0A",
    textMuted: "#5C6370",
    textTertiary: "#8B929E",
    hairline: "#E3E6EB",
    borderStrong: "#C9CED6",
    marketYes: "#00CE8E",
    marketYesBg: "#E8FFF6",
    marketNo: "#FF3B5C",
    marketNoBg: "#FFE8EC",
    marketNeutral: "#8B929E",
    focusRing: "rgba(212,27,44,0.35)",
  },
  // Shared 6-token outcome palette (D-3), indexed by outcome sort_order.
  //
  // CONTRACT (NFR-7): color is a SECONDARY signal. Outcomes must always be
  // distinguishable by label and position first; the palette only reinforces.
  // Tokens alternate light/dark luminance so neighboring outcomes stay
  // distinguishable in grayscale - the spread is guarded in theme.test.ts.
  // marketYes/marketNo remain for settled win/loss coloring ONLY (A-7);
  // outcome identity is never "green = yes".
  outcomePalette: [
    "#00CE8E", // 0 - Yes hue (binary continuity)
    "#FF3B5C", // 1 - No hue (binary continuity)
    "#F5A623", // 2 - amber
    "#4C7DFF", // 3 - blue
    "#00B8D4", // 4 - teal
    "#9B59D0", // 5 - purple
  ],
  // Mirrors `colors`, swapped for the .dark surface stack in globals.css.
  // JS-side twin for values recharts needs as SVG attrs, where CSS custom
  // properties aren't available. Brand/market/outcome hues are unchanged -
  // see the .dark rule in globals.css for why.
  darkColors: {
    page: "#0B0D10",
    card: "#15181D",
    muted: "#1E2228",
    inverse: "#1A1E24",
    ink: "#0A0A0A",
    red: "#D41B2C",
    redHover: "#B01524",
    redBright: "#E31837",
    text: "#F2F3F5",
    textMuted: "#9AA1AC",
    textTertiary: "#6B7280",
    hairline: "#262B32",
    borderStrong: "#363C45",
    marketYes: "#00CE8E",
    marketYesBg: "#0D2B22",
    marketNo: "#FF3B5C",
    marketNoBg: "#33131B",
    marketNeutral: "#8B929E",
    focusRing: "rgba(212,27,44,0.35)",
  },
  fonts: {
    serif: "var(--font-source-serif)",
    sans: "var(--font-hanken)",
    mono: "var(--font-plex-mono)",
  },
  radius: {
    none: "0",
    sm: "6px",
    md: "8px",
    lg: "12px",
    pill: "999px",
  },
  shadow: {
    card: "0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)",
    cardHover: "0 2px 4px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08)",
  },
  motion: {
    easeStandard: "cubic-bezier(0.2, 0, 0.1, 1)",
    durationFast: "120ms",
    durationNormal: "200ms",
  },
} as const;

export type Theme = typeof theme;

/** Series color for an outcome, indexed by its canonical sort_order. */
export function outcomeColor(sortOrder: number): string {
  return theme.outcomePalette[
    ((sortOrder % theme.outcomePalette.length) + theme.outcomePalette.length) %
      theme.outcomePalette.length
  ];
}
