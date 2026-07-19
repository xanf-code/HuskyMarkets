import { formatCents, formatHC } from "@/lib/format";
import type { ShareCard } from "@/lib/queries/share";
import { OG_COLORS, OG_FONT } from "./theme";

export function BetOgCard({ card }: { card: ShareCard }) {
  const sideColor =
    card.side === "yes" ? OG_COLORS.marketYes : OG_COLORS.marketNo;

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
            fontSize: 28,
            fontWeight: 600,
            color: sideColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {`Called it at ${formatCents(card.priceAtBet)}`}
        </span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            fontFamily: OG_FONT.serif,
            color: OG_COLORS.red,
          }}
        >
          HuskyMarkets
        </span>
      </div>

      <div
        style={{
          marginTop: 40,
          backgroundColor: OG_COLORS.card,
          border: `1px solid ${OG_COLORS.hairline}`,
          borderRadius: 12,
          padding: "48px 56px",
          boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
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
            fontSize: 68,
            fontWeight: 600,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{formatHC(card.stake)}</span>
          <span style={{ color: OG_COLORS.muted, fontSize: 52 }}>→</span>
          <span style={{ color: OG_COLORS.marketYes }}>{formatHC(card.payout)}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1px solid ${OG_COLORS.hairline}`,
          marginTop: 40,
          paddingTop: 24,
          fontSize: 24,
          color: OG_COLORS.muted,
        }}
      >
        <span>{card.displayName}</span>
        <span style={{ color: sideColor, fontWeight: 600 }}>
          {`${card.side.toUpperCase()} · huskymarkets`}
        </span>
      </div>
    </div>
  );
}
