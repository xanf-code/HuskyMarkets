export const theme = {
  colors: {
    page: "#000000",
    ink: "#0A0A0A",
    red: "#D41B2C",
    redHover: "#B01524",
    redBright: "#E31837",
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.72)",
    hairline: "rgba(255,255,255,0.28)",
    focusRing: "rgba(212,27,44,0.35)",
  },
  fonts: {
    serif: "var(--font-source-serif)",
    sans: "var(--font-hanken)",
    mono: "var(--font-plex-mono)",
  },
  radius: {
    none: "0",
    sm: "2px",
  },
  motion: {
    easeStandard: "cubic-bezier(0.2, 0, 0.1, 1)",
    durationFast: "120ms",
    durationNormal: "200ms",
  },
} as const;

export type Theme = typeof theme;
