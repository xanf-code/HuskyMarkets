import type { Metadata } from "next";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { createClient } from "@/lib/supabase/server";
import { getPortfolio } from "@/lib/queries/portfolio";

export const metadata: Metadata = {
  title: "Portfolio · HuskyMarkets",
};

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const portfolio = await getPortfolio(user!.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <h1 className="text-3xl font-semibold text-text sm:text-4xl">
          Your book
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Open positions, settled bets, and the full HuskyCoin ledger.
        </p>
      </div>
      <PortfolioTabs
        open={portfolio.open}
        resolved={portfolio.resolved}
        ledger={portfolio.ledger}
      />
    </div>
  );
}
