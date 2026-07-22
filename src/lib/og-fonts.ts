// Font loading for ImageResponse OG routes. Fonts are bundled subsetted TTFs
// under src/assets/fonts (see docs/implementation_sofar.md, Phase 8), read
// from disk once and memoized - the first OG request pays the read, later
// requests reuse it. OG routes run in the Node runtime (fs access); see the
// ImageResponse docs for this pattern.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal";
};

const ENTRIES: Array<[file: string, name: string, weight: OgFont["weight"]]> = [
  ["SourceSerif4-Regular.ttf", "Source Serif 4", 400],
  ["SourceSerif4-SemiBold.ttf", "Source Serif 4", 600],
  ["HankenGrotesk-Regular.ttf", "Hanken Grotesk", 400],
  ["HankenGrotesk-SemiBold.ttf", "Hanken Grotesk", 600],
  ["IBMPlexMono-Regular.ttf", "IBM Plex Mono", 400],
  ["IBMPlexMono-Medium.ttf", "IBM Plex Mono", 500],
];

async function load(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(process.cwd(), "src/assets/fonts", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

let cached: Promise<OgFont[]> | null = null;

export function getOgFonts(): Promise<OgFont[]> {
  cached ??= Promise.all(
    ENTRIES.map(async ([file, name, weight]) => ({
      name,
      weight,
      style: "normal" as const,
      data: await load(file),
    })),
  );
  return cached;
}
