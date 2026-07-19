import { formatCents, formatHC } from "@/lib/format";
import type { ShareCard } from "@/lib/queries/share";
import { OG_COLORS, OG_FONT } from "./theme";

export function BetOgCard({ card }: { card: ShareCard }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG_COLORS.bg,
        color: OG_COLORS.text,
        padding: 72,
        fontFamily: OG_FONT.sans,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: OG_FONT.mono,
            fontSize: 30,
            fontWeight: 500,
            color: OG_COLORS.red,
          }}
        >
          {`Called it at ${formatCents(card.priceAtBet)}`}
        </span>
        <span style={{ fontSize: 24, fontWeight: 600, color: OG_COLORS.text }}>
          HuskyMarkets
        </span>
      </div>

      <div
        style={{
          width: 120,
          height: 8,
          backgroundColor: OG_COLORS.red,
          marginTop: 40,
        }}
      />

      <div
        style={{
          marginTop: 32,
          fontFamily: OG_FONT.serif,
          fontSize: 56,
          lineHeight: 1.15,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {card.marketTitle}
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "baseline",
          gap: 24,
          fontFamily: OG_FONT.mono,
          fontSize: 72,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        <span>{formatHC(card.stake)}</span>
        <span style={{ color: OG_COLORS.muted, fontSize: 56 }}>→</span>
        <span style={{ color: OG_COLORS.red }}>{formatHC(card.payout)}</span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid ${OG_COLORS.hairline}`,
          marginTop: 48,
          paddingTop: 28,
          fontSize: 26,
          color: OG_COLORS.muted,
        }}
      >
        <span>{card.displayName}</span>
        <span style={{ fontFamily: OG_FONT.mono }}>
          {`${card.side.toUpperCase()} · huskymarkets`}
        </span>
      </div>
    </div>
  );
}
