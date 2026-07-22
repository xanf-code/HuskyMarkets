"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pending", label: "Pending" },
  { href: "/admin/resolve", label: "Resolve" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/markets", label: "Markets" },
  { href: "/admin/semesters", label: "Semesters" },
  { href: "/admin/mods", label: "Mods" },
  { href: "/admin/log", label: "Log" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <div className="flex gap-1 border-b border-hairline sm:gap-2">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors duration-200 ease-standard focus-visible:outline-red ${
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
  );
}
