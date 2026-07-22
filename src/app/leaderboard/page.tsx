import type { Metadata } from "next";
import { LeaderboardTabs } from "@/components/leaderboard/LeaderboardTabs";
import { LockedLeaderboard } from "@/components/leaderboard/LockedLeaderboard";
import {
  getAccuracyBoard,
  getCurrentSemester,
  getHallOfFame,
  getSemesterBoard,
} from "@/lib/queries/leaderboard";
import { getSession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Leaderboard · HuskyMarkets",
};

function Hero() {
  return (
    <div>
      <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
        Leaderboard
      </h1>
      <p className="mt-2 text-pretty text-sm text-text-muted">
        Semester standings from 1,000 HuskyCoin. Accuracy needs ten settled
        bets.
      </p>
    </div>
  );
}

export default async function LeaderboardPage() {
  const session = await getSession();

  // Guests see the hero and a fade-locked placeholder - none of the board
  // queries fire, so no standings data leaves the server.
  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
        <Hero />
        <LockedLeaderboard />
      </div>
    );
  }

  const semester = await getCurrentSemester();
  const [semesterEntries, accuracyEntries, hallOfFame] = await Promise.all([
    semester ? getSemesterBoard(semester.id) : Promise.resolve([]),
    semester ? getAccuracyBoard(semester.id) : Promise.resolve([]),
    getHallOfFame(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Hero />
      <LeaderboardTabs
        semesterEntries={semesterEntries}
        accuracyEntries={accuracyEntries}
        hallOfFame={hallOfFame}
        currentUserId={session.userId}
        semesterName={semester?.name}
      />
    </div>
  );
}
