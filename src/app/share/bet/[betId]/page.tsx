import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/Button";
import { HcAmount } from "@/components/ui/HcAmount";
import { formatHC, formatPercent } from "@/lib/format";
import { getShareCard } from "@/lib/queries/share";

interface ShareBetPageProps {
  params: Promise<{ betId: string }>;
}

export async function generateMetadata({
  params,
}: ShareBetPageProps): Promise<Metadata> {
  const { betId } = await params;
  const card = await getShareCard(betId);
  if (!card) notFound();
  return {
    title: `Called it at ${formatPercent(card.priceAtBet)} — HuskyMarkets`,
    description: `${card.displayName} backed ${card.outcomeLabel} on "${card.marketTitle}" at ${formatPercent(card.priceAtBet)} and turned ${formatHC(card.stake)} into ${formatHC(card.payout)}.`,
    openGraph: { images: [`/api/og/bet/${betId}`] },
  };
}

export default async function ShareBetPage({ params }: ShareBetPageProps) {
  const { betId } = await params;
  const card = await getShareCard(betId);
  if (!card) notFound();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center">
      <p className="num text-lg font-semibold text-market-yes sm:text-xl">
        Called it at {formatPercent(card.priceAtBet)}
      </p>
      <h1 className="mt-3 text-2xl font-semibold leading-snug text-text sm:text-4xl">
        {card.marketTitle}
      </h1>
      <p className="mt-6 flex flex-wrap items-center gap-3 text-3xl font-semibold text-text sm:text-5xl">
        <HcAmount amount={card.stake} size={36} />
        <span className="text-xl font-normal text-text-muted sm:text-3xl">
          to
        </span>
        <span className="text-market-yes">
          <HcAmount amount={card.payout} size={36} />
        </span>
      </p>
      <p className="mt-4 text-sm text-text-muted">
        {card.displayName} backed{" "}
        <span className="text-market-yes">{card.outcomeLabel}</span> on
        HuskyMarkets.
      </p>
      <div className="mt-10 border-t border-hairline pt-6">
        <Link href={`/market/${card.marketId}`} className={buttonStyles()}>
          View the market
        </Link>
      </div>
    </div>
  );
}
