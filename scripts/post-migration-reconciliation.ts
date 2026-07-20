#!/usr/bin/env node
// REC-17 post-migration reconciliation (E-6 / S6-2). Re-captures the boards
// and profile stats AFTER the migration and diffs against the pre-migration
// snapshot. Zero-diff is required (FR-32); any delta exits non-zero (NFR-8).
//
// Usage from repo root:
//   npx tsx --env-file=.env.local scripts/post-migration-reconciliation.ts

export {};

import { readFileSync } from "node:fs";
import path from "node:path";
import { captureSnapshot } from "./lib/capture-snapshot";
import { diffSnapshots, type BoardSnapshot } from "../src/lib/reconciliation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  const file = path.resolve(__dirname, "../ops/pre-migration-snapshot.json");
  let before: BoardSnapshot;
  try {
    before = JSON.parse(readFileSync(file, "utf8")) as BoardSnapshot;
  } catch {
    console.error(
      "No ops/pre-migration-snapshot.json found — run scripts/pre-migration-snapshot.ts first.",
    );
    process.exit(1);
  }

  // Pass the pre-migration snapshot's capturedAt as the resolved-before cutoff
  // so the re-captured boards only include markets resolved before the snapshot.
  // Any remaining diff is therefore "unexplained" and attributable to the
  // migration itself — no 2 a.m. judgment call needed (W2 / REC-17).
  console.log(`Baseline captured at ${before.capturedAt}. Re-capturing with cutoff ${before.capturedAt}…`);
  const after = await captureSnapshot(SUPABASE_URL, SERVICE_ROLE_KEY, before.capturedAt);

  const diff = diffSnapshots(before, after);
  if (diff.length === 0) {
    console.log("Reconciliation clean: zero diff. History reconciles (FR-32).");
    process.exit(0);
  }

  console.error(`Reconciliation FAILED — ${diff.length} delta(s):`);
  for (const line of diff) console.error(`  ${line}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
