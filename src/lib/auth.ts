const NEU_DOMAIN = "northeastern.edu";

export function isNeuEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return false;
  return trimmed.slice(at + 1) === NEU_DOMAIN;
}

const PUBLIC_EXACT = new Set(["/login", "/tos"]);
const PUBLIC_PREFIXES = ["/share/", "/api/og/"];

export function getAuthRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (isAuthenticated) return null;
  if (PUBLIC_EXACT.has(pathname)) return null;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }
  return "/login";
}
