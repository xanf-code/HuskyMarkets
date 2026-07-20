"use client";

import type { Appearance } from "@/lib/appearance";
import { applyAppearance, useAppearance } from "@/lib/use-appearance";

interface AppearanceToggleProps {
  /** Server-read cookie value, so the switch renders correctly on first paint. */
  initialAppearance: Appearance;
}

export function AppearanceToggle({ initialAppearance }: AppearanceToggleProps) {
  const appearance = useAppearance(initialAppearance);
  const isDark = appearance === "dark";

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-text">Dark mode</p>
        <p className="text-sm text-text-muted">
          {isDark ? "On for this device." : "Off — using the light theme."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        onClick={() => applyAppearance(isDark ? "light" : "dark")}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border transition-colors duration-200 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
          isDark ? "border-red bg-red" : "border-border-strong bg-muted"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-4 rounded-pill bg-card shadow-card transition-transform duration-200 ease-standard ${
            isDark ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
