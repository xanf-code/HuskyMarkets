import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportQueue } from "@/components/admin/ReportQueue";
import { ResolveQueue } from "@/components/admin/ResolveQueue";
import { getReportQueue, getResolveQueue } from "@/lib/queries/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Moderator · HuskyMarkets",
};

export default async function ModPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff || !user) redirect("/");

  const [resolve, reports] = await Promise.all([
    getResolveQueue(user.id),
    getReportQueue(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 py-8 sm:py-12">
      <div>
        <h1 className="text-3xl font-semibold text-text sm:text-4xl">
          Moderator dashboard
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Markets you created or bet on are excluded — the server enforces the
          same conflict rule.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-text">Resolve queue</h2>
        <ResolveQueue items={resolve} />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-text">Report queue</h2>
        <ReportQueue items={reports} />
      </section>
    </div>
  );
}
