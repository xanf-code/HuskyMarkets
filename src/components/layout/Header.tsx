"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/create", label: "Create" },
  { href: "/profile", label: "Profile" },
];

const GUEST_NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

interface HeaderProps {
  authenticated: boolean;
  /** Server-rendered balance chip, passed as a slot since Header is a client component. */
  balance?: ReactNode;
}

export function Header({ authenticated, balance }: HeaderProps) {
  const pathname = usePathname();
  const items = authenticated ? NAV_ITEMS : GUEST_NAV_ITEMS;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap focus-visible:outline-red"
        >
          <span className="brand-serif text-xl text-text sm:text-2xl">
            Husky
          </span>
          <span className="text-xl font-bold text-red sm:text-2xl">
            Markets
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="min-w-0 flex-1 overflow-x-auto"
        >
          <div className="flex items-center gap-1 sm:gap-2">
            {items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-pill px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ease-standard focus-visible:outline-red ${
                    active
                      ? "bg-red/10 text-red"
                      : "text-text-muted hover:bg-muted hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {authenticated ? (
          balance
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-md border border-border-strong bg-card px-4 py-2 text-sm font-semibold text-text transition-colors duration-200 ease-standard hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
