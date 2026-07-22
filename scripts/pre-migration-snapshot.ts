#!/usr/bin/env node
// REC-17 pre-migration snapshot (E-6 / S6-2). Captures the accuracy board,
// semester board, and a sample of get_profile_stats BEFORE the multi-outcome
// migration deploys, pseudonymized, to ops/pre-migration-snapshot.json.
//
// TIMING REQUIREMENT (W2): run this script inside the deploy window,
// immediately before `supabase db push`. 0011's table locks freeze all writes
// between snapshot and conversion, so any resolution in the gap between
// snapshot and migration will cause a false reconciliation failure. Running
// immediately before push makes the gap near-zero by construction.
//
// Usage from repo root:
//   npx tsx --env-file=.env.local scripts/pre-migration-snapshot.ts

export {};

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { captureSnapshot } from "./lib/capture-snapshot";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  console.log(`Capturing pre-migration snapshot from ${SUPABASE_URL} …`);
  const snapshot = await captureSnapshot(SUPABASE_URL, SERVICE_ROLE_KEY);

  const dir = path.resolve(__dirname, "../ops");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "pre-migration-snapshot.json");
  writeFileSync(file, JSON.stringify(snapshot, null, 2));

  console.log(
    `Snapshot written to ops/pre-migration-snapshot.json ` +
      `(${snapshot.accuracy.length} accuracy rows, ${snapshot.semester.length} semester rows, ` +
      `${Object.keys(snapshot.profileStats).length} profile stats).`,
  );
  console.log("Store this artifact in the ops location - it is the reconciliation baseline.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
