import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents, formatHC } from "@/lib/format";
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
    title: `Called it at ${formatCents(card.priceAtBet)} — HuskyMarkets`,
    description: `${card.displayName} backed ${card.side.toUpperCase()} on "${card.marketTitle}" at ${formatCents(card.priceAtBet)} and turned ${formatHC(card.stake)} into ${formatHC(card.payout)}.`,
    openGraph: { images: [`/api/og/bet/${betId}`] },
  };
}

export default async function ShareBetPage({ params }: ShareBetPageProps) {
  const { betId } = await params;
  const card = await getShareCard(betId);
  if (!card) notFound();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center">
      <p className="num text-lg font-medium text-red-bright sm:text-xl">
        Called it at {formatCents(card.priceAtBet)}
      </p>
      <h1 className="mt-3 font-serif text-2xl leading-snug text-text sm:text-4xl">
        {card.marketTitle}
      </h1>
      <p className="num mt-6 text-3xl font-medium text-text sm:text-5xl">
        {formatHC(card.stake)}{" "}
        <span className="text-text-muted">→</span>{" "}
        <span className="text-red-bright">{formatHC(card.payout)}</span>
      </p>
      <p className="mt-4 text-sm text-text-muted">
        {card.displayName} backed {card.side.toUpperCase()} on HuskyMarkets.
      </p>
      <div className="mt-10 border-t border-hairline pt-6">
        <Link
          href={`/market/${card.marketId}`}
          className="eyebrow inline-block text-red-bright focus-visible:outline-red"
        >
          View the market →
        </Link>
      </div>
    </div>
  );
}
