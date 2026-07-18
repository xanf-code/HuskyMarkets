import type { Metadata } from "next";
import { formatHC } from "@/components/layout/BalanceChip";
import { Chip } from "@/components/ui/Chip";
import { BAILOUT_THRESHOLD } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { BailoutButton } from "./BailoutButton";

export const metadata: Metadata = {
  title: "Profile · HuskyMarkets",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: balanceData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, real_name, anon_handle, display_mode, role")
      .eq("id", user!.id)
      .single(),
    supabase.rpc("get_my_balance"),
  ]);

  const balance = typeof balanceData === "number" ? balanceData : 0;
  const displayName =
    profile?.display_mode === "real"
      ? (profile.real_name ?? profile.anon_handle)
      : profile?.anon_handle;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 sm:py-16">
      <div>
        <p className="eyebrow text-red-bright">Profile</p>
        <h1 className="mt-3 font-serif text-3xl text-text sm:text-4xl">
          {displayName}
        </h1>
        <p className="mt-2 text-sm text-text-muted">{profile?.email}</p>
      </div>

      <dl className="grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-3">
        <div className="bg-page p-4 sm:p-5">
          <dt className="eyebrow text-text-muted">Balance</dt>
          <dd className="num mt-2 text-2xl text-text">{formatHC(balance)}</dd>
        </div>
        <div className="bg-page p-4 sm:p-5">
          <dt className="eyebrow text-text-muted">Display mode</dt>
          <dd className="mt-2">
            <Chip active>
              {profile?.display_mode === "real" ? "Real name" : "Anonymous"}
            </Chip>
          </dd>
        </div>
        <div className="bg-page p-4 sm:p-5">
          <dt className="eyebrow text-text-muted">Handle</dt>
          <dd className="num mt-2 text-base text-text">
            {profile?.anon_handle}
          </dd>
        </div>
      </dl>

      {balance < BAILOUT_THRESHOLD ? (
        <section className="border border-hairline p-4 sm:p-6">
          <h2 className="font-serif text-xl text-text">Broke?</h2>
          <p className="mt-2 mb-4 text-sm text-text-muted">
            Your balance is below {BAILOUT_THRESHOLD} HC, so you can take one
            bailout per week. It keeps you trading, but it counts against you
            on the leaderboard.
          </p>
          <BailoutButton />
        </section>
      ) : null}
    </div>
  );
}
