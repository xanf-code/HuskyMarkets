import { ImageResponse } from "next/og";
import { MarketOgCard } from "@/components/og/MarketOgCard";
import { OG_SIZE } from "@/components/og/theme";
import { getOgFonts } from "@/lib/og-fonts";
import { getMarketCard } from "@/lib/queries/share";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const card = await getMarketCard(id);
  if (!card) return new Response("Not found", { status: 404 });
  return new ImageResponse(<MarketOgCard card={card} />, {
    ...OG_SIZE,
    fonts: await getOgFonts(),
  });
}
