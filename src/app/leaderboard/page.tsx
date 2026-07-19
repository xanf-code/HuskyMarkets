import type { Metadata } from "next";
import { LeaderboardTabs } from "@/components/leaderboard/LeaderboardTabs";
import {
  getAccuracyBoard,
  getCurrentSemester,
  getHallOfFame,
  getSemesterBoard,
} from "@/lib/queries/leaderboard";
import { verifySession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Leaderboard · HuskyMarkets",
};

export default async function LeaderboardPage() {
  const { userId } = await verifySession();

  const semester = await getCurrentSemester();
  const [semesterEntries, accuracyEntries, hallOfFame] = await Promise.all([
    semester ? getSemesterBoard(semester.id) : Promise.resolve([]),
    semester ? getAccuracyBoard(semester.id) : Promise.resolve([]),
    getHallOfFame(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div className="rounded-lg bg-inverse px-6 py-8 text-white sm:px-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">By the numbers</h1>
        <p className="mt-2 text-sm text-white/72">
          Semester scores start everyone at 1,000 HC. Accuracy needs ten
          resolved bets.
        </p>
      </div>
      <LeaderboardTabs
        semesterEntries={semesterEntries}
        accuracyEntries={accuracyEntries}
        hallOfFame={hallOfFame}
        currentUserId={userId}
        semesterName={semester?.name}
      />
    </div>
  );
}
