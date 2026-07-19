// Shared visual theme for OG cards. Values mirror globals.css tokens and the
// bundled font names registered in src/lib/og-fonts.ts.

export const OG_COLORS = {
  bg: "#F5F6F8",
  card: "#FFFFFF",
  text: "#0A0A0A",
  muted: "#5C6370",
  hairline: "#E3E6EB",
  red: "#D41B2C",
  marketYes: "#00CE8E",
  marketNo: "#FF3B5C",
} as const;

export const OG_FONT = {
  serif: "Source Serif 4",
  sans: "Hanken Grotesk",
  mono: "IBM Plex Mono",
} as const;

export const OG_SIZE = { width: 1200, height: 630 } as const;

const ET_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

export function ogDate(iso: string): string {
  return ET_DATE.format(new Date(iso));
}
