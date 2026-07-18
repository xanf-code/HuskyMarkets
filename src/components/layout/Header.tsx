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

interface HeaderProps {
  authenticated: boolean;
  /** Server-rendered balance chip, passed as a slot since Header is a client component. */
  balance?: ReactNode;
}

export function Header({ authenticated, balance }: HeaderProps) {
  const pathname = usePathname();

  // App chrome (nav + balance) is only meaningful once signed in. Unauthenticated
  // visitors only ever see public pages (login, tos, shared bets), which supply
  // their own headings, so render nothing rather than leaking the signed-in shell.
  if (!authenticated) return null;

  return (
    <header className="border-b border-hairline bg-page">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 sm:px-6 sm:pt-4">
        <Link
          href="/"
          className="flex items-baseline gap-1.5 whitespace-nowrap focus-visible:outline-red"
        >
          <span className="font-serif text-xl text-text sm:text-2xl">
            Husky
          </span>
          <span className="text-xl font-bold text-red-bright sm:text-2xl">
            Markets
          </span>
        </Link>
        {balance}
      </div>
      <nav
        aria-label="Primary"
        className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6"
      >
        <div className="flex gap-6">
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
                className={`-mb-px border-b-2 py-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ease-standard focus-visible:outline-red ${
                  active
                    ? "border-red text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
