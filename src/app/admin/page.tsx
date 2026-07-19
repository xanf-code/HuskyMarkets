import Link from "next/link";
import {
  getPendingApplications,
  getReportQueue,
  getResolveQueue,
} from "@/lib/queries/admin";

export default async function AdminHomePage() {
  const [resolve, reports, apps] = await Promise.all([
    getResolveQueue(),
    getReportQueue(),
    getPendingApplications(),
  ]);

  const cards = [
    { href: "/admin/resolve", label: "Resolve queue", count: resolve.length },
    { href: "/admin/reports", label: "Open reports", count: reports.length },
    {
      href: "/admin/mods",
      label: "Pending mod apps",
      count: apps.length,
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-3">
      {cards.map((c) => (
        <li key={c.href} className="bg-page p-5">
          <Link
            href={c.href}
            className="block focus-visible:outline-red"
          >
            <p className="font-serif text-3xl text-red-bright">{c.count}</p>
            <p className="mt-2 text-sm font-bold text-text">{c.label}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
