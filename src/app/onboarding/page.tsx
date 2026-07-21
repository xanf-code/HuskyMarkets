import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = {
  title: "Welcome · HuskyMarkets",
};

export default async function OnboardingPage() {
  const { userId } = await verifySession();
  const supabase = await createClient();

  // Proxy guarantees a signed-in, un-onboarded visitor here; fetch the
  // handle the signup trigger generated.
  const { data: profile } = await supabase
    .from("profiles")
    .select("anon_handle")
    .eq("id", userId)
    .single();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 py-8 sm:py-16">
      <div>
        <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
          Set your board name
        </h1>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          1,000 HuskyCoin to start. About a minute — then pick a campus take.
        </p>
      </div>

      <ol className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:px-5">
        <li className="flex gap-3 text-sm">
          <span className="num shrink-0 font-semibold text-red">1</span>
          <span className="text-pretty text-text-muted">
            <span className="font-semibold text-text">Odds</span> are the
            chance the board implies right now — not a guarantee.
          </span>
        </li>
        <li className="flex gap-3 text-sm">
          <span className="num shrink-0 font-semibold text-red">2</span>
          <span className="text-pretty text-text-muted">
            <span className="font-semibold text-text">Stake</span> free
            HuskyCoin on an outcome. One bet puts you on the semester
            leaderboard.
          </span>
        </li>
        <li className="flex gap-3 text-sm">
          <span className="num shrink-0 font-semibold text-red">3</span>
          <span className="text-pretty text-text-muted">
            <span className="font-semibold text-text">Win</span> and Portfolio
            unlocks a share card — brag the take that paid.
          </span>
        </li>
      </ol>

      <OnboardingForm initialHandle={profile?.anon_handle ?? "Husky"} />
    </div>
  );
}
