import type { Metadata } from "next";
import Link from "next/link";
import { formatHC } from "@/lib/format";
import { Chip } from "@/components/ui/Chip";
import { StatBlock } from "@/components/ui/StatBlock";
import { BAILOUT_THRESHOLD } from "@/lib/constants";
import { getProfileStats } from "@/lib/queries/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { BailoutButton } from "./BailoutButton";
import { ModApplicationForm } from "./ModApplicationForm";

export const metadata: Metadata = {
  title: "Profile · HuskyMarkets",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: balanceData }, stats, { data: pendingApp }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("email, real_name, anon_handle, display_mode, role")
        .eq("id", user!.id)
        .single(),
      supabase.rpc("get_my_balance"),
      getProfileStats(user!.id),
      supabase
        .from("mod_applications")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

  const balance = typeof balanceData === "number" ? balanceData : 0;
  const displayName =
    profile?.display_mode === "real"
      ? (profile.real_name ?? profile.anon_handle)
      : profile?.anon_handle;

  const streakLabel =
    stats.currentStreak === 0
      ? "—"
      : stats.currentStreak > 0
        ? `${stats.currentStreak}W`
        : `${Math.abs(stats.currentStreak)}L`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 sm:py-16">
      <div>
        <p className="eyebrow text-red-bright">Profile</p>
        <h1 className="mt-3 font-serif text-3xl text-text sm:text-4xl">
          {displayName}
        </h1>
        <p className="mt-2 text-sm text-text-muted">{profile?.email}</p>
        {profile?.role === "admin" || profile?.role === "moderator" ? (
          <p className="mt-3 flex flex-wrap gap-3 text-sm">
            {profile.role === "admin" ? (
              <Link
                href="/admin"
                className="font-semibold text-red-bright focus-visible:outline-red"
              >
                Admin console →
              </Link>
            ) : null}
            {profile.role === "moderator" || profile.role === "admin" ? (
              <Link
                href="/mod"
                className="font-semibold text-red-bright focus-visible:outline-red"
              >
                Moderator dashboard →
              </Link>
            ) : null}
          </p>
        ) : null}
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

      <section>
        <h2 className="eyebrow mb-3 text-text-muted">Career stats</h2>
        <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-3">
          <StatBlock label="Biggest win" value={formatHC(stats.biggestWin)} />
          <StatBlock label="Worst loss" value={formatHC(stats.worstLoss)} />
          <StatBlock label="Current streak" value={streakLabel} />
        </div>
      </section>

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

      {profile?.role === "user" ? (
        <section className="border border-hairline p-4 sm:p-6">
          <h2 className="font-serif text-xl text-text">Moderation</h2>
          <p className="mt-2 mb-4 text-sm text-text-muted">
            Help resolve markets and triage reports. Admins review every
            application.
          </p>
          {pendingApp ? (
            <p className="text-sm text-text-muted">
              Your application is pending review.
            </p>
          ) : (
            <ModApplicationForm />
          )}
        </section>
      ) : null}
    </div>
  );
}
