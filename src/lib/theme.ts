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
