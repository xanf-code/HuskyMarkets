"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  PROMO_DISMISSED_EVENT,
  isPromoBannerDismissed,
} from "@/lib/onboarding-flags";

type Props = {
  /** When true, hide while the guest promo banner is still showing. */
  onlyAfterPromoDismissed?: boolean;
};

/** Permanent leaderboard prize callout — not dismissible on its own. */
export function LeaderboardPrizeCard({
  onlyAfterPromoDismissed = false,
}: Props) {
  const [show, setShow] = useState(!onlyAfterPromoDismissed);

  useEffect(() => {
    if (!onlyAfterPromoDismissed) return;

    function sync() {
      setShow(isPromoBannerDismissed());
    }

    sync();
    window.addEventListener(PROMO_DISMISSED_EVENT, sync);
    return () => window.removeEventListener(PROMO_DISMISSED_EVENT, sync);
  }, [onlyAfterPromoDismissed]);

  if (!show) return null;

  return (
    <aside
      aria-label="Semester prize"
      className="card-surface flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5"
    >
      <div className="shrink-0">
        <Image
          src="/gift-card.png"
          alt=""
          width={56}
          height={35}
          className="h-auto w-auto rounded object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">
          Win a{" "}
          <span className="text-red">$150 Campus Store gift card</span>
        </p>
        <p className="mt-0.5 text-pretty text-xs leading-snug text-text-muted">
          #1 on the Fall 2026 semester leaderboard
        </p>
      </div>
    </aside>
  );
}
