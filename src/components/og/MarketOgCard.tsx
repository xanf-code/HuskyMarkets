import { CATEGORIES } from "@/lib/constants";
import { formatCents, formatHC } from "@/lib/format";
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
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: OG_COLORS.muted,
          }}
        >
          {categoryLabel}
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
          fontSize: 64,
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
          fontFamily: OG_FONT.mono,
          fontSize: 128,
          fontWeight: 500,
          color: OG_COLORS.red,
          lineHeight: 1,
        }}
      >
        {`YES ${formatCents(card.yesPrice)}`}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid ${OG_COLORS.hairline}`,
          marginTop: 48,
          paddingTop: 28,
          fontFamily: OG_FONT.mono,
          fontSize: 26,
          color: OG_COLORS.muted,
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
