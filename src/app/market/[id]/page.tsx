import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/market/ActivityFeed";
import { Countdown } from "@/components/market/Countdown";
import { MarketStats } from "@/components/market/MarketStats";
import { OrderPanel } from "@/components/market/OrderPanel";
import { ProbabilityChart } from "@/components/market/ProbabilityChart";
import { ReportDialog } from "@/components/market/ReportDialog";
import { Chip } from "@/components/ui/Chip";
import { CATEGORIES } from "@/lib/constants";
import { formatCents, marketVolume } from "@/lib/format";
import { impliedYes } from "@/lib/payout";
import { getMarketDetail } from "@/lib/queries/markets";

const ET_DATETIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

const STATUS_BANNERS: Record<string, string> = {
  closed: "Closed — awaiting resolution",
  resolved_yes: "Resolved YES",
  resolved_no: "Resolved NO",
  voided: "Voided — all stakes refunded",
};

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { id } = await params;
  const detail = await getMarketDetail(id);
  if (!detail) notFound();

  const { market } = detail;
  const price = impliedYes(market.yes_pool, market.no_pool);
  const categoryLabel =
    CATEGORIES.find((c) => c.value === market.category)?.label ??
    market.category;
  const banner = STATUS_BANNERS[market.status];

  return (
    // Mobile: hero → order panel → supporting detail. Desktop: panel docks
    // into a sticky right rail beside both content blocks.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6">
      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Chip>{categoryLabel}</Chip>
            <Countdown closeAt={market.close_at} />
          </div>
          <h1 className="mt-3 font-serif text-2xl leading-snug text-text sm:text-4xl">
            {market.title}
          </h1>
          {market.description ? (
            <p className="mt-2 max-w-2xl text-sm text-text-muted sm:text-base">
              {market.description}
            </p>
          ) : null}
        </div>

        {banner ? (
          <p className="num border border-hairline border-l-2 border-l-red px-4 py-3 text-sm text-text">
            &gt; {banner}
          </p>
        ) : null}

        <div>
          <p className="num text-4xl font-medium text-red-bright sm:text-5xl">
            YES {formatCents(price)}
          </p>
          <div className="mt-4">
            <ProbabilityChart history={detail.history} />
          </div>
        </div>
      </div>

      <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
        <OrderPanel
          marketId={market.id}
          status={market.status}
          closeAt={market.close_at}
          yesPool={market.yes_pool}
          noPool={market.no_pool}
          position={detail.position}
          balance={detail.balance}
        />
        {detail.position.yes + detail.position.no > 0 ? (
          <p className="num mt-3 text-xs text-text-muted">
            Your position: {detail.position.yes} HC YES ·{" "}
            {detail.position.no} HC NO
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
        <MarketStats
          yesPool={market.yes_pool}
          noPool={market.no_pool}
          volume={marketVolume(market.yes_pool, market.no_pool)}
          bettorCount={detail.bettorCount}
        />

        <section aria-label="Rules" className="border border-hairline">
          <h2 className="eyebrow border-b border-hairline px-4 py-3 text-text-muted">
            Rules
          </h2>
          <div className="flex flex-col gap-3 px-4 py-4 text-sm">
            <p className="text-text">{market.resolution_criteria}</p>
            <dl className="grid grid-cols-1 gap-2 text-text-muted sm:grid-cols-2">
              <div>
                <dt className="eyebrow">Closes</dt>
                <dd className="num mt-1">
                  {ET_DATETIME.format(new Date(market.close_at))}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Resolves by</dt>
                <dd className="num mt-1">
                  {ET_DATETIME.format(new Date(market.resolve_at))}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Created by</dt>
                <dd className="mt-1">{detail.creatorName}</dd>
              </div>
              <div>
                <dt className="eyebrow">Category</dt>
                <dd className="mt-1">{categoryLabel}</dd>
              </div>
            </dl>
            <ReportDialog marketId={market.id} />
          </div>
        </section>

        <section aria-label="Activity">
          <h2 className="eyebrow mb-3 text-text-muted">Recent activity</h2>
          <ActivityFeed activity={detail.activity} />
        </section>
      </div>
    </div>
  );
}
