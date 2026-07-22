"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import type {
  BetHistoryRow,
  CreatedMarket,
  LedgerEntry,
  OpenPosition,
  ResolvedPosition,
} from "@/lib/queries/portfolio";
import { BetHistoryList } from "./BetHistoryList";
import { CreatedMarketsList } from "./CreatedMarketsList";
import { LedgerTable } from "./LedgerTable";
import { PositionsTable } from "./PositionsTable";
import { ResolvedHistory } from "./ResolvedHistory";

const TABS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "created", label: "Created" },
  { id: "history", label: "History" },
  { id: "ledger", label: "Ledger" },
];

interface PortfolioTabsProps {
  open: OpenPosition[];
  resolved: ResolvedPosition[];
  ledger: LedgerEntry[];
  created: CreatedMarket[];
  betHistory: BetHistoryRow[];
}

export function PortfolioTabs({
  open,
  resolved,
  ledger,
  created,
  betHistory,
}: PortfolioTabsProps) {
  const [active, setActive] = useState("open");

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        tabs={TABS}
        active={active}
        onChange={setActive}
        ariaLabel="Portfolio sections"
      />
      {active === "open" ? <PositionsTable positions={open} /> : null}
      {active === "resolved" ? <ResolvedHistory rows={resolved} /> : null}
      {active === "created" ? <CreatedMarketsList markets={created} /> : null}
      {active === "history" ? <BetHistoryList rows={betHistory} /> : null}
      {active === "ledger" ? <LedgerTable entries={ledger} /> : null}
    </div>
  );
}
