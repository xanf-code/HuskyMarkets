import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { MAX_OUTCOMES } from "@/lib/constants";
import { getSession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CreateMarketForm } from "@/app/create/CreateMarketForm";

interface EditMarketPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditMarketPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data ? `Edit: ${data.title} · HuskyMarkets` : "Edit pool · HuskyMarkets" };
}

export default async function EditMarketPage({ params }: EditMarketPageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const [{ data: market }, { data: outcomes }, { data: cfg }, { data: isAdmin }] =
    await Promise.all([
      supabase
        .from("markets")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("market_outcomes")
        .select("id, label, sort_order, is_catch_all")
        .eq("market_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("app_config")
        .select("int_val")
        .eq("key", "max_outcomes")
        .single(),
      supabase.rpc("is_admin"),
    ]);

  if (!market) notFound();

  if (market.creator_id !== session.userId && !isAdmin) redirect(`/market/${id}`);

  const hasBets = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("market_id", id)
    .limit(1)
    .then(({ count }) => (count ?? 0) > 0);

  if (hasBets) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 sm:py-12">
        <div>
          <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
            Edit pool
          </h1>
        </div>
        <div className="card-surface px-4 py-6 text-sm text-text-muted">
          <p className="font-semibold text-text">Editing locked</p>
          <p className="mt-2">
            This pool has bets and can no longer be edited. You can still lock
            or delete it from the pool page.
          </p>
          <Link
            href={`/market/${id}`}
            className="mt-4 inline-block text-sm font-semibold text-red hover:underline"
          >
            ← Back to pool
          </Link>
        </div>
      </div>
    );
  }

  const maxOutcomes = cfg?.int_val ?? MAX_OUTCOMES;
  const normalOutcomes = (outcomes ?? [])
    .filter((o) => !o.is_catch_all)
    .map((o) => o.label);
  const catchAll = (outcomes ?? []).some((o) => o.is_catch_all);

  function toDatetimeLocal(iso: string): string {
    // Slice the UTC ISO string directly so the prefilled value is always in
    // UTC — matching how localInputToIso() re-parses it on submit (as UTC).
    // Using local-time getters here would format in the server's timezone
    // (UTC on Vercel), while the browser re-parses in the user's TZ, silently
    // shifting close_at/resolve_at by the UTC offset on every save.
    return new Date(iso).toISOString().slice(0, 16);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
          Edit pool
        </h1>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          Changes are locked once the first bet is placed.
        </p>
      </div>
      <CreateMarketForm
        mode="edit"
        marketId={id}
        maxOutcomes={maxOutcomes}
        initial={{
          title: market.title,
          description: market.description ?? "",
          category: market.category,
          closeAt: toDatetimeLocal(market.close_at),
          resolveAt: toDatetimeLocal(market.resolve_at),
          resolutionCriteria: market.resolution_criteria,
          outcomes: normalOutcomes,
          catchAll,
        }}
      />
    </div>
  );
}
