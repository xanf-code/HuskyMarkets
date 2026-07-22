import type { Metadata } from "next";
import { MAX_OUTCOMES } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CreateMarketForm } from "./CreateMarketForm";

export const metadata: Metadata = {
  title: "Create · HuskyMarkets",
};

export default async function CreatePage() {
  await verifySession();
  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("app_config")
    .select("int_val")
    .eq("key", "max_outcomes")
    .single();
  const maxOutcomes = cfg?.int_val ?? MAX_OUTCOMES;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
          Create a market
        </h1>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          Clear criteria and a public source - no private lives.
        </p>
      </div>
      <CreateMarketForm maxOutcomes={maxOutcomes} />
    </div>
  );
}
