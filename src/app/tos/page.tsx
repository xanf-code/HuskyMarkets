import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · HuskyMarkets",
};

const TERMS = [
  {
    heading: "HuskyCoin has no cash value",
    body: "HuskyCoin (HC) is a virtual play-money token. It is not money, not a security, and not redeemable for anything. It cannot be bought, sold, cashed out, or transferred outside the app.",
  },
  {
    heading: "No purchases, no prizes",
    body: "There is nothing to buy on HuskyMarkets and nothing of monetary value to win. Balances, bonuses, bailouts, and leaderboard placements exist for entertainment and bragging rights only.",
  },
  {
    heading: "Northeastern community only",
    body: "Accounts are limited to @northeastern.edu email addresses. Markets that target, harass, or speculate about private individuals are removed and may lead to account action.",
  },
  {
    heading: "Play nice",
    body: "Moderators and admins may close, void, or hide markets, and adjust or revoke accounts that abuse the system. Their resolution decisions are final.",
  },
];

export default function TosPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-8 sm:py-16">
      <div>
        <p className="eyebrow text-red-bright">The fine print</p>
        <h1 className="mt-3 font-serif text-3xl text-text sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          The short version: it&apos;s all for fun, and none of it is money.
        </p>
      </div>
      <ol className="space-y-6">
        {TERMS.map((term, index) => (
          <li key={term.heading} className="border-l-2 border-red pl-4 sm:pl-6">
            <h2 className="font-serif text-xl text-text">
              {index + 1}. {term.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              {term.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
