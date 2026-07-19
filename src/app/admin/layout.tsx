import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/resolve", label: "Resolve" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/markets", label: "Markets" },
  { href: "/admin/semesters", label: "Semesters" },
  { href: "/admin/mods", label: "Mods" },
  { href: "/admin/log", label: "Log" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <p className="eyebrow text-red-bright">Admin</p>
        <h1 className="mt-3 font-serif text-3xl text-text sm:text-4xl">
          Console
        </h1>
      </div>
      <nav
        aria-label="Admin"
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex gap-4 border-b border-hairline">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 border-b-2 border-transparent py-3 text-sm font-semibold text-text-muted hover:text-text focus-visible:outline-red"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
