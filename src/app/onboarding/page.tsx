import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = {
  title: "Welcome · HuskyMarkets",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy guarantees a signed-in, un-onboarded visitor here; fetch the
  // handle the signup trigger generated.
  const { data: profile } = await supabase
    .from("profiles")
    .select("anon_handle")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <p className="eyebrow text-red-bright">One last step</p>
        <h1 className="mt-3 font-serif text-3xl text-text sm:text-4xl">
          Choose your identity
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          You start with 1,000 HuskyCoin. Decide how your trades are
          attributed — you can change this any time.
        </p>
      </div>
      <OnboardingForm initialHandle={profile?.anon_handle ?? "Husky"} />
    </div>
  );
}
