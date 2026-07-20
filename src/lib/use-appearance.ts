"use client";

import { useSyncExternalStore } from "react";
import { APPEARANCE_COOKIE, APPEARANCE_COOKIE_OPTIONS, type Appearance } from "./appearance";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Appearance {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Reactive appearance mirroring the `dark` class on <html>. Any component
 * calling {@link applyAppearance} anywhere on the page updates every reader
 * of this hook instantly, with no context provider required.
 *
 * `initial` is only consulted as the Server Components render (React never
 * calls the client `getSnapshot` during SSR) — it must match whatever class
 * the root layout already put on <html> from the same cookie, otherwise
 * React logs a hydration-mismatch warning. It is NOT applied to the DOM by
 * this hook; only {@link applyAppearance} mutates the class, so multiple
 * instances of this hook (e.g. one per chart) never fight over it.
 */
export function useAppearance(initial: Appearance = "light"): Appearance {
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}

/** Flips the `dark` class on <html> and persists the choice for future requests. */
export function applyAppearance(value: Appearance): void {
  document.documentElement.classList.toggle("dark", value === "dark");
  const maxAge = APPEARANCE_COOKIE_OPTIONS.maxAge;
  document.cookie = `${APPEARANCE_COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
}
