import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
import { CATEGORIES } from "@/lib/constants";
import { formatCents, formatHC } from "@/lib/format";
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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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
    description: `YES at ${formatCents(card.yesPrice)} · ${formatHC(card.volume)} wagered — HuskyMarkets`,
    openGraph: { images: [`/api/og/market/${id}`] },
  };
}

export default async function MarketPage({
  params,
  searchParams,
}: MarketPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const sideParam = Array.isArray(query.side) ? query.side[0] : query.side;
  const initialSide =
    sideParam === "yes" || sideParam === "no" ? sideParam : undefined;
  const detail = await getMarketDetail(id);
  if (!detail) notFound();

  const { market } = detail;
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;

  return (
    <MarketLiveProvider
      marketId={market.id}
      initial={{
        yesPool: market.yes_pool,
        noPool: market.no_pool,
        status: market.status,
        history: detail.history,
        activity: detail.activity,
      }}
    >
      {/* Mobile: hero → order panel → supporting detail. Desktop: panel docks
          into a sticky right rail beside both content blocks. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6">
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Chip>{categoryLabel}</Chip>
              <Countdown closeAt={market.close_at} />
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-snug text-text sm:text-4xl">
              {market.title}
            </h1>
            {market.description ? (
              <p className="mt-2 max-w-2xl text-sm text-text-muted sm:text-base">
                {market.description}
              </p>
            ) : null}
          </div>

          <LiveStatusBanner />

          <div>
            <LivePrice />
            <div className="mt-4">
              <LiveChart />
            </div>
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
          <LiveOrderPanel
            marketId={market.id}
            closeAt={market.close_at}
            position={detail.position}
            balance={detail.balance}
            initialSide={initialSide}
            question={market.title}
          />
          {detail.position.yes + detail.position.no > 0 ? (
            <p className="num mt-3 text-xs text-text-muted">
              Your position: {detail.position.yes} HC Yes ·{" "}
              {detail.position.no} HC No
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
          <LiveStats bettorCount={detail.bettorCount} />

          <section aria-label="Rules" className="card-surface overflow-hidden">
            <h2 className="border-b border-hairline bg-muted/50 px-4 py-3 text-sm font-semibold text-text">
              Rules
            </h2>
            <div className="flex flex-col gap-3 px-4 py-4 text-sm">
              <p className="text-text">{market.resolution_criteria}</p>
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
                  <dd className="mt-1 text-text">{detail.creatorName}</dd>
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
            <LiveActivity />
          </section>
        </div>
      </div>
    </MarketLiveProvider>
  );
}
