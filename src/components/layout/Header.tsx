"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/create", label: "Create" },
];

export function Header() {
  const pathname = usePathname();

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
        <div className="num border border-hairline px-3 py-1.5 text-sm text-text">
          1,000 HC
        </div>
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
