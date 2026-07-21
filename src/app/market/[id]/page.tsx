import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LockedPanel } from "@/components/auth/LockedPanel";
import { Countdown } from "@/components/market/Countdown";
import {
  LiveActivity,
  LiveChart,
  LiveOrderPanel,
  LivePrice,
  LiveStats,
  LiveStatusBanner,
  MarketLiveProvider,
} from "@/components/market/MarketLive";
import { ReportDialog } from "@/components/market/ReportDialog";
import { Chip } from "@/components/ui/Chip";
import { HcAmount } from "@/components/ui/HcAmount";
import { CATEGORIES } from "@/lib/constants";
import { formatHC, formatPercent } from "@/lib/format";
import { getMarketDetail } from "@/lib/queries/markets";
import { getMarketCard } from "@/lib/queries/share";

const ET_DATETIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

interface MarketMetadataProps {
  params: Promise<{ id: string }>;
}

// Uses the anon-safe share-card RPC so metadata resolves for any client that
// can reach the page; the page body still requires a session via the proxy.
export async function generateMetadata({
  params,
}: MarketMetadataProps): Promise<Metadata> {
  const { id } = await params;
  const card = await getMarketCard(id);
  if (!card) return { title: "Market — HuskyMarkets" };
  return {
    title: `${card.title} — HuskyMarkets`,
    description: `${card.leading.label} at ${formatPercent(card.leading.price)} · ${formatHC(card.volume)} in play — HuskyMarkets`,
    openGraph: { images: [`/api/og/market/${id}`] },
  };
}

export default async function MarketPage({
  params,
}: MarketPageProps) {
  const { id } = await params;
  // Legacy `?side=yes|no` deep links degrade gracefully: the parameter is
  // ignored, no outcome is preselected (A-4).
  const detail = await getMarketDetail(id);
  if (!detail) notFound();

  const { market } = detail;
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;
  const totalStaked = detail.position.reduce((sum, p) => sum + p.stake, 0);

  return (
    <MarketLiveProvider
      marketId={market.id}
      initial={{
        outcomes: detail.outcomes,
        status: market.status,
        winningOutcomeId: market.winning_outcome_id,
        history: detail.history,
        activity: detail.activity,
      }}
    >
      {/* Mobile: title → bet ticket → chart → supporting (thumb-first bet).
          Desktop: panel docks into a sticky right rail beside both content blocks. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6">
        <div className="order-1 flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Chip>{categoryLabel}</Chip>
              <Countdown closeAt={market.close_at} />
            </div>
            <h1 className="mt-3 break-words text-balance text-2xl font-semibold leading-snug text-text sm:text-4xl">
              {market.title}
            </h1>
            {market.description ? (
              <p className="mt-2 max-w-2xl text-pretty break-words text-sm text-text-muted sm:text-base">
                {market.description}
              </p>
            ) : null}
          </div>

          <LiveStatusBanner />
        </div>

        <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-24">
          <LiveOrderPanel
            marketId={market.id}
            closeAt={market.close_at}
            position={detail.position}
            balance={detail.balance}
            question={market.title}
            guest={detail.isGuest}
          />
          {totalStaked > 0 ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              <span>Your position:</span>
              {detail.position.map((p, i) => (
                <span key={p.outcomeId} className="inline-flex items-center gap-1">
                  {i > 0 ? <span aria-hidden="true">·</span> : null}
                  <HcAmount amount={p.stake} size={12} />
                  <span className="truncate">{p.label}</span>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        <div className="order-3 lg:col-start-1 lg:row-start-2">
          <LivePrice />
          <div className="mt-4">
            <LiveChart />
          </div>
        </div>

        <div className="order-4 flex flex-col gap-6 lg:col-start-1 lg:row-start-3">
          <LiveStats bettorCount={detail.bettorCount} />

          <section aria-label="Rules" className="card-surface overflow-hidden">
            <h2 className="border-b border-hairline bg-muted/50 px-4 py-3 text-sm font-semibold text-text">
              Rules
            </h2>
            <div className="flex flex-col gap-3 px-4 py-4 text-sm">
              <p className="break-words text-text">{market.resolution_criteria}</p>
              <dl className="grid grid-cols-1 gap-2 text-text-muted sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium">Closes</dt>
                  <dd className="num mt-1 text-text">
                    {ET_DATETIME.format(new Date(market.close_at))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium">Resolves by</dt>
                  <dd className="num mt-1 text-text">
                    {ET_DATETIME.format(new Date(market.resolve_at))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium">Created by</dt>
                  <dd className="mt-1 truncate text-text">{detail.creatorName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium">Category</dt>
                  <dd className="mt-1 text-text">{categoryLabel}</dd>
                </div>
              </dl>
              <ReportDialog marketId={market.id} />
            </div>
          </section>

          <section aria-label="Activity">
            <h2 className="mb-3 text-sm font-semibold text-text">
              Recent activity
            </h2>
            {detail.isGuest ? (
              <LockedPanel variant="activity" />
            ) : (
              <LiveActivity />
            )}
          </section>
        </div>
      </div>
    </MarketLiveProvider>
  );
}
