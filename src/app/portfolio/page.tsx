import type { Metadata } from "next";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { verifySession } from "@/lib/dal";
import { getPortfolio } from "@/lib/queries/portfolio";

export const metadata: Metadata = {
  title: "Portfolio · HuskyMarkets",
};

export default async function PortfolioPage() {
  const { userId } = await verifySession();

  const portfolio = await getPortfolio(userId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
          Your book
        </h1>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          Open takes, settled scores, and every HuskyCoin move.
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
