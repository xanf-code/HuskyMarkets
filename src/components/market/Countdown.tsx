"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";

const TICK_MS = 30_000;

/** Live countdown to a market's close; re-renders twice a minute. */
export function Countdown({ closeAt }: { closeAt: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="num text-sm text-text-muted" suppressHydrationWarning>
      {formatCountdown(closeAt, now)}
    </span>
  );
}
