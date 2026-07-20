import { CATEGORIES } from "@/lib/constants";
import { formatHC, formatPercent } from "@/lib/format";
import type { MarketCard } from "@/lib/queries/share";
import { OG_COLORS, OG_FONT, ogDate } from "./theme";

export function MarketOgCard({ card }: { card: MarketCard }) {
  const categoryLabel =
    CATEGORIES.find((c) => c.value === card.category)?.label ?? card.category;
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
            fontSize: 22,
            fontWeight: 600,
            color: OG_COLORS.muted,
            backgroundColor: "#EEF0F3",
            borderRadius: 999,
            padding: "8px 18px",
          }}
        >
          {categoryLabel}
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
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.15,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {card.title}
        </div>

        <div
          style={{
            marginTop: "auto",
            fontSize: 112,
            fontWeight: 600,
            color: OG_COLORS.marketYes,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {`${card.leading.label} ${formatPercent(card.leading.price)}`}
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
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          {`${formatHC(card.volume)} wagered · closes ${ogDate(card.closeAt)}`}
        </span>
        <span>huskymarkets</span>
      </div>
    </div>
  );
}
