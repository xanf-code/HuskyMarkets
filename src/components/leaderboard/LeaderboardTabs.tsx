"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import type {
  AccuracyEntry,
  HallOfFameEntry,
  SemesterEntry,
} from "@/lib/queries/leaderboard";
import { AccuracyBoard } from "./AccuracyBoard";
import { HallOfFame } from "./HallOfFame";
import { SemesterBoard } from "./SemesterBoard";

const TABS = [
  { id: "semester", label: "Semester" },
  { id: "accuracy", label: "Accuracy" },
  { id: "fame", label: "Hall of Fame" },
];

interface LeaderboardTabsProps {
  semesterEntries: SemesterEntry[];
  accuracyEntries: AccuracyEntry[];
  hallOfFame: HallOfFameEntry[];
  currentUserId?: string;
  semesterName?: string;
}

export function LeaderboardTabs({
  semesterEntries,
  accuracyEntries,
  hallOfFame,
  currentUserId,
  semesterName,
}: LeaderboardTabsProps) {
  const [active, setActive] = useState("semester");

  return (
    <div className="flex flex-col gap-6">
      {semesterName ? (
        <p className="text-sm text-text-muted">Current window: {semesterName}</p>
      ) : null}
      <Tabs
        tabs={TABS}
        active={active}
        onChange={setActive}
        ariaLabel="Leaderboard boards"
      />
      {active === "semester" ? (
        <SemesterBoard
          entries={semesterEntries}
          currentUserId={currentUserId}
        />
      ) : null}
      {active === "accuracy" ? (
        <AccuracyBoard
          entries={accuracyEntries}
          currentUserId={currentUserId}
        />
      ) : null}
      {active === "fame" ? <HallOfFame entries={hallOfFame} /> : null}
    </div>
  );
}
