"use client";

import { useEffect, useRef } from "react";
import { claimDailyBonus } from "@/actions/bonus";
import { useToast } from "@/components/ui/Toast";
import { DAILY_BONUS } from "@/lib/constants";
import { etDayKey } from "@/lib/time";

export const DAILY_BONUS_STORAGE_KEY = "hm.dailyBonus.lastClaimedDay";

/**
 * Invisible mount-time claimer. The localStorage guard only saves an RPC per
 * navigation — the claim itself is idempotent server-side (partial unique
 * index on the ET day_key), so a cleared cache or second device can never
 * double-credit.
 */
export function DailyBonusClaimer() {
  const { push } = useToast();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const today = etDayKey();
    if (window.localStorage.getItem(DAILY_BONUS_STORAGE_KEY) === today) return;

    void claimDailyBonus().then((result) => {
      if (!result.ok) return;
      window.localStorage.setItem(DAILY_BONUS_STORAGE_KEY, today);
      if (result.claimed) {
        push(`+${DAILY_BONUS} HC daily bonus`);
      }
    });
  }, [push]);

  return null;
}
