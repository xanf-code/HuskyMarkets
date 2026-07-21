import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { createClient } from "@/lib/supabase/server";

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
        <h1 className="text-3xl font-semibold text-text sm:text-4xl">
          Admin console
        </h1>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
