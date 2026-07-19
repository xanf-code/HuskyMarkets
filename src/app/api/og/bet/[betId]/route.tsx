import { ImageResponse } from "next/og";
import { BetOgCard } from "@/components/og/BetOgCard";
import { OG_SIZE } from "@/components/og/theme";
import { getOgFonts } from "@/lib/og-fonts";
import { getShareCard } from "@/lib/queries/share";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ betId: string }> },
) {
  const { betId } = await ctx.params;
  const card = await getShareCard(betId);
  if (!card) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BetOgCard card={card} />, {
    ...OG_SIZE,
    fonts: await getOgFonts(),
  });
}
