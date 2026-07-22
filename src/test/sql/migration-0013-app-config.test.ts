// W1 / S7-3 - app_config-driven outcome cap.
//
// Verifies that create_market reads max_outcomes from app_config at call time
// so the soak cap is a runtime lever, not a compile-time constant.

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, setUid } from "./harness";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function callCreateMarket(
  db: PGlite,
  uid: string,
  outcomes: string[],
): Promise<unknown> {
  await setUid(db, uid);
  const r = await db.query<{ m: unknown }>(
    `select public.create_market(
       $1, $2, $3::public.market_category, $4,
       $5::timestamptz, $6::timestamptz, $7::jsonb, false) as m`,
    [
      "Will something happen on campus?",
      null,
      "campus",
      "Resolves when the thing is officially confirmed.",
      future(1),
      future(2),
      JSON.stringify(outcomes),
    ],
  );
  return r.rows[0].m;
}

describe("app_config table (0013)", () => {
  let db: PGlite;

  beforeEach(async () => {
    // Apply all migrations including 0013.
    db = await bootTestDb(13);
  });

  it("seeds max_outcomes=6 by default", async () => {
    const r = await db.query<{ int_val: number }>(
      "select int_val from public.app_config where key = 'max_outcomes'",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].int_val).toBe(6);
  });
});

describe("create_market with runtime cap (0013 / S7-3)", () => {
  let db: PGlite;
  let uid: string;

  beforeEach(async () => {
    db = await bootTestDb(13);
    uid = await createUser(db);
  });

  it("still accepts 2–6 outcomes under the default cap", async () => {
    await expect(callCreateMarket(db, uid, ["A", "B"])).resolves.toBeDefined();
    await expect(
      callCreateMarket(db, uid, ["A", "B", "C", "D", "E", "F"]),
    ).resolves.toBeDefined();
  });

  it("rejects >cap outcomes when cap is lowered to 2 (S7-3 acceptance criterion)", async () => {
    await db.exec(
      "update public.app_config set int_val = 2 where key = 'max_outcomes'",
    );

    await expect(
      callCreateMarket(db, uid, ["A", "B", "C"]),
    ).rejects.toThrow();
  });

  it("accepts exactly cap outcomes when cap is lowered to 2", async () => {
    await db.exec(
      "update public.app_config set int_val = 2 where key = 'max_outcomes'",
    );

    await expect(callCreateMarket(db, uid, ["A", "B"])).resolves.toBeDefined();
  });

  it("hard floor of 2 is enforced even when cap is set to 1", async () => {
    await db.exec(
      "update public.app_config set int_val = 1 where key = 'max_outcomes'",
    );

    // The function clamps effective_max = greatest(2, configured); so a single
    // outcome is still rejected.
    await expect(callCreateMarket(db, uid, ["Solo"])).rejects.toThrow();
  });
});
