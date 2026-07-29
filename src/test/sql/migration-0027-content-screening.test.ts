import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createAdmin, setUid } from "./harness";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createMarket(
  db: PGlite,
  title: string,
  outcomes: string[],
  autoFlagged: boolean,
) {
  return db.query<{ market: { market_id: string; status: string } }>(
    `select public.create_market(
       $1, '', 'campus'::public.market_category, $2,
       $3::timestamptz, $4::timestamptz, $5::jsonb, false, $6
     ) as market`,
    [
      title,
      "Resolves from an official university announcement.",
      future(1),
      future(2),
      JSON.stringify(outcomes),
      autoFlagged,
    ],
  );
}

describe("database-enforced market content screening (0027)", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await bootTestDb(27);
    const adminId = await createAdmin(db);
    await setUid(db, adminId);
    await db.exec(
      "update public.app_config set int_val = 0 where key = 'market_cooldown_seconds'",
    );
  });

  it("does not let a direct RPC caller suppress a moderation flag", async () => {
    await expect(
      createMarket(
        db,
        "Will Jake Thompson hook up with anyone at the formal?",
        ["Yes", "No"],
        false,
      ),
    ).rejects.toThrow("market content requires moderation");
  });

  it("keeps the server-screened path and routes flagged content to pending", async () => {
    const result = await createMarket(
      db,
      "Will Jake Thompson hook up with anyone at the formal?",
      ["Yes", "No"],
      true,
    );

    expect(result.rows[0].market.status).toBe("pending");
  });

  it("hard-blocks prohibited content even when the caller acknowledges a flag", async () => {
    await expect(
      createMarket(
        db,
        "Will this prohibited market be published on campus?",
        ["Yes", "The retard wins"],
        true,
      ),
    ).rejects.toThrow("market content violates community standards");
  });

  it("still immediately publishes clean content for trusted creators", async () => {
    const result = await createMarket(
      db,
      "Will the Huskies win their next home basketball game?",
      ["Yes", "No"],
      false,
    );

    expect(result.rows[0].market.status).toBe("open");
  });
});
