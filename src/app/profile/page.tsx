import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AppearanceToggle } from "@/components/layout/AppearanceToggle";
import { buttonStyles } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { HcAmount } from "@/components/ui/HcAmount";
import { StatBlock } from "@/components/ui/StatBlock";
import { APPEARANCE_COOKIE } from "@/lib/appearance";
import { BAILOUT_THRESHOLD } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { getProfileStats } from "@/lib/queries/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { BailoutButton } from "./BailoutButton";
import { ModApplicationForm } from "./ModApplicationForm";

export const metadata: Metadata = {
  title: "Profile · HuskyMarkets",
};

export default async function ProfilePage() {
  const { userId } = await verifySession();
  const supabase = await createClient();
  const cookieStore = await cookies();
  const initialAppearance =
    cookieStore.get(APPEARANCE_COOKIE)?.value === "dark" ? "dark" : "light";

  const [{ data: profile }, { data: balanceData }, stats, { data: pendingApp }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("email, real_name, anon_handle, display_mode, role")
        .eq("id", userId)
        .single(),
      supabase.rpc("get_my_balance"),
      getProfileStats(userId),
      supabase
        .from("mod_applications")
        .select("id")
        .eq("user_id", userId)
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
        <h1 className="text-3xl font-semibold text-text sm:text-4xl">
          {displayName}
        </h1>
        <p className="mt-2 text-sm text-text-muted">{profile?.email}</p>
        {profile?.role === "admin" || profile?.role === "moderator" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {profile.role === "admin" ? (
              <Link
                href="/admin"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Admin console
              </Link>
            ) : null}
            {profile.role === "moderator" || profile.role === "admin" ? (
              <Link
                href="/mod"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Moderator dashboard
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="card-surface grid grid-cols-1 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-hairline">
        <div className="border-b border-hairline p-4 sm:border-b-0 sm:p-5">
          <dt className="text-sm font-semibold text-text-muted">Balance</dt>
          <dd className="mt-2 text-2xl text-text">
            <HcAmount amount={balance} size={22} />
          </dd>
        </div>
        <div className="border-b border-hairline p-4 sm:border-b-0 sm:p-5">
          <dt className="text-sm font-semibold text-text-muted">Display mode</dt>
          <dd className="mt-2">
            <Chip active>
              {profile?.display_mode === "real" ? "Real name" : "Anonymous"}
            </Chip>
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-sm font-semibold text-text-muted">Handle</dt>
          <dd className="num mt-2 text-base text-text">
            {profile?.anon_handle}
          </dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text-muted">
          Career stats
        </h2>
        <div className="card-surface grid grid-cols-1 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-hairline">
          <StatBlock
            label="Biggest win"
            value={<HcAmount amount={stats.biggestWin} size={28} />}
          />
          <StatBlock
            label="Worst loss"
            value={<HcAmount amount={stats.worstLoss} size={28} />}
          />
          <StatBlock label="Current streak" value={streakLabel} />
        </div>
      </section>

      <section className="card-surface p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-text-muted">
          Appearance
        </h2>
        <AppearanceToggle initialAppearance={initialAppearance} />
      </section>

      {balance < BAILOUT_THRESHOLD ? (
        <section className="card-surface p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-text">Broke?</h2>
          <p className="mt-2 mb-4 text-sm text-text-muted">
            Your balance is below {BAILOUT_THRESHOLD} HuskyCoin, so you can claim
            one bailout per week. It tops you back up, but hides you from the
            leaderboard until next Monday.
          </p>
          <BailoutButton />
        </section>
      ) : null}

      {profile?.role === "user" ? (
        <section className="card-surface p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-text">Moderation</h2>
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
