// Device-level light/dark preference. Captured during onboarding and
// editable later from the profile page. Deliberately NOT httpOnly — the
// profile toggle writes it straight from the client via document.cookie for
// an instant switch, with the server read in the root layout keeping the
// very first paint on every subsequent request flash-free.

export const APPEARANCE_COOKIE = "hm-appearance";

export const APPEARANCE_COOKIE_OPTIONS = {
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export type Appearance = "light" | "dark";

export function isAppearance(value: string | undefined | null): value is Appearance {
  return value === "light" || value === "dark";
}
