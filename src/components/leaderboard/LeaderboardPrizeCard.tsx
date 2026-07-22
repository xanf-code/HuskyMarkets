import Image from "next/image";

/** Permanent leaderboard prize callout — always visible, not dismissible. */
export function LeaderboardPrizeCard() {
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
