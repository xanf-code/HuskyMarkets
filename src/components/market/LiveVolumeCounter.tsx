"use client";

// Home live counter: server seeds all-time SUM(bets.amount), then guest-safe
// market_outcomes UPDATEs trigger a get_platform_volume refetch. Digits count
// up over adjustable durationMs; slot width tracks the widest formatted value
// so commas/digits never shove neighboring layout.

import { useEffect, useRef, useState } from "react";
import { HuskyCoinIcon } from "@/components/icons/HuskyCoinIcon";
import {
  formatHC,
  formatHCNumber,
  interpolateVolume,
  volumeSlotCh,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_DURATION_MS = 800;

interface LiveVolumeCounterProps {
  initialVolume: number;
  /** Count-up duration when volume jumps. Adjustable; 0 snaps instantly. */
  durationMs?: number;
}

export function LiveVolumeCounter({
  initialVolume,
  durationMs = DEFAULT_DURATION_MS,
}: LiveVolumeCounterProps) {
  const [target, setTarget] = useState(initialVolume);
  const [displayed, setDisplayed] = useState(initialVolume);

  const [syncedInitial, setSyncedInitial] = useState(initialVolume);
  if (initialVolume !== syncedInitial) {
    setSyncedInitial(initialVolume);
    setTarget(initialVolume);
    setDisplayed(initialVolume);
  }

  // Realtime: pool moves ⇒ someone bet ⇒ refetch authoritative sum.
  useEffect(() => {
    const supabase = createClient();
    let requestId = 0;

    const channel = supabase
      .channel("platform:volume")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "market_outcomes" },
        async () => {
          const id = ++requestId;
          const { data } = await supabase.rpc("get_platform_volume");
          if (id !== requestId) return;
          if (typeof data === "number") setTarget(data);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Count displayed toward target over durationMs (ease-out via interpolateVolume).
  const fromRef = useRef(displayed);
  useEffect(() => {
    if (displayed === target && fromRef.current === target) return;

    if (durationMs <= 0) {
      fromRef.current = target;
      setDisplayed(target);
      return;
    }

    const from = displayed;
    fromRef.current = from;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = (now - start) / durationMs;
      const next = interpolateVolume(from, target, progress);
      setDisplayed(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Intentionally only re-run when the settled target or duration changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayed is the animation source, not a trigger
  }, [target, durationMs]);

  const slotCh = volumeSlotCh(displayed, target);

  return (
    <section
      aria-label="Platform volume"
      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
    >
      <p className="text-sm text-text-muted">Volume traded</p>
      <p
        className="inline-flex items-center gap-1.5 text-text"
        aria-live="polite"
        aria-atomic="true"
        aria-label={formatHC(target)}
      >
        <HuskyCoinIcon size={18} />
        <span
          data-testid="volume-slot"
          className="num inline-block text-xl font-semibold tabular-nums sm:text-2xl"
          style={{ minWidth: `${slotCh}ch` }}
          aria-hidden="true"
        >
          {formatHCNumber(displayed)}
        </span>
      </p>
    </section>
  );
}
