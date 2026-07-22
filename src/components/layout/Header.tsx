"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { UserMenu } from "./UserMenu";

const NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/create", label: "Create" },
];

const GUEST_NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

interface HeaderProps {
  authenticated: boolean;
  /** Server-rendered balance chip, passed as a slot since Header is a client component. */
  balance?: ReactNode;
  /** Server-rendered notification bell, passed as a slot for the same reason. */
  notifications?: ReactNode;
}

export function Header({ authenticated, balance, notifications }: HeaderProps) {
  const pathname = usePathname();
  // Authenticated phones use BottomNav; keep pills in the header from md up.
  // Guests only have two links, so they stay in the header at all sizes.
  const items = authenticated ? NAV_ITEMS : GUEST_NAV_ITEMS;

  return (
    <header
      className="sticky top-0 z-40 border-b border-hairline bg-card/95 backdrop-blur-sm"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap focus-visible:outline-red"
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
          className={`min-w-0 flex-1 overflow-x-auto ${
            authenticated ? "hidden md:block" : ""
          }`}
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
                  className={`inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ease-standard focus-visible:outline-red ${
                    active
                      ? "bg-red/10 text-red"
                      : "text-text-muted hover:bg-muted hover:text-text active:bg-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {authenticated && (
          <>
            <div className="min-w-0 flex-1 md:hidden" aria-hidden="true" />
            <span className="flex shrink-0 items-center gap-2 sm:gap-3">
              {balance}
              {notifications}
              <UserMenu />
            </span>
          </>
        )}
      </div>
    </header>
  );
}
