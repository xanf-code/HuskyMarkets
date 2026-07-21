"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/create", label: "Create" },
];

/**
 * Thumb-zone primary nav for authenticated phones. Desktop keeps the header
 * pills; this bar is md:hidden so the two never stack.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-card/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-7xl items-stretch">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 min-w-0 flex-1 items-center justify-center px-1 text-xs font-semibold transition-colors duration-200 ease-standard focus-visible:outline-red ${
                active
                  ? "text-red"
                  : "text-text-muted active:bg-muted active:text-text"
              }`}
            >
              <span
                className={`rounded-pill px-2.5 py-1.5 ${
                  active ? "bg-red/10" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
