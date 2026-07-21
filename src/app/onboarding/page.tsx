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
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
          Set your board name
        </h1>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          1,000 HuskyCoin to start. You can change this later.
        </p>
      </div>
      <OnboardingForm initialHandle={profile?.anon_handle ?? "Husky"} />
    </div>
  );
}
