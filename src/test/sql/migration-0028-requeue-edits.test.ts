import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createAdmin, createUser, setUid } from "./harness";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const original = {
  title: "Will the Huskies win their next home basketball game?",
  description: "A market about the next scheduled home game.",
  category: "sports",
  criteria: "Resolves from the official final score after the game.",
  outcomes: ["Yes", "No"],
  closeAt: future(3),
  resolveAt: future(4),
};

describe("0028 requeue edited markets", () => {
  let db: PGlite;
  let creatorId: string;
  let adminId: string;
  let marketId: string;

  beforeEach(async () => {
    db = await bootTestDb(28);
    creatorId = await createUser(db);
    adminId = await createAdmin(db);
    await setUid(db, creatorId);

    const market = await db.query<{ id: string }>(
      `insert into public.markets
         (creator_id, title, description, category, resolution_criteria,
          close_at, resolve_at, status)
       values ($1, $2, $3, $4::public.market_category, $5,
               $6::timestamptz, $7::timestamptz, 'open')
       returning id`,
      [
        creatorId,
        original.title,
        original.description,
        original.category,
        original.criteria,
        original.closeAt,
        original.resolveAt,
      ],
    );
    marketId = market.rows[0].id;

    await db.query(
      `insert into public.market_outcomes
         (market_id, label, sort_order, pool, is_catch_all)
       values ($1, 'Yes', 0, 100, false), ($1, 'No', 1, 100, false)`,
      [marketId],
    );
  });

  async function updateMarket(
    overrides: Partial<typeof original> = {},
    autoFlagged = false,
  ): Promise<void> {
    const market = { ...original, ...overrides };
    await db.query(
      `select public.update_market(
         $1, $2, $3, $4::public.market_category, $5,
         $6::timestamptz, $7::timestamptz, $8::jsonb, false, $9
       )`,
      [
        marketId,
        market.title,
        market.description,
        market.category,
        market.criteria,
        market.closeAt,
        market.resolveAt,
        JSON.stringify(market.outcomes),
        autoFlagged,
      ],
    );
  }

  async function status(): Promise<string> {
    const result = await db.query<{ status: string }>(
      "select status::text as status from public.markets where id = $1",
      [marketId],
    );
    return result.rows[0].status;
  }

  it("sends creator content edits back to staff review", async () => {
    await updateMarket({
      title: "Will a named student be expelled before the semester ends?",
      description: "Replacement content that was never reviewed by staff.",
    });

    expect(await status()).toBe("pending");
  });

  it("requeues outcome-only edits", async () => {
    await updateMarket({ outcomes: ["Win", "Lose", "Draw"] });

    expect(await status()).toBe("pending");
  });

  it("keeps timing-only edits open", async () => {
    await updateMarket({
      closeAt: future(5),
      resolveAt: future(6),
    });

    expect(await status()).toBe("open");
  });

  it("allows admins to correct content without re-review", async () => {
    await setUid(db, adminId);
    await updateMarket({
      title: "Will the Huskies win the corrected home basketball matchup?",
    });

    expect(await status()).toBe("open");
  });
});
