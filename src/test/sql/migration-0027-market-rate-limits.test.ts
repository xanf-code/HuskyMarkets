import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, setUid } from "./harness";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createMarket(db: PGlite, title: string): Promise<void> {
  await db.query(
    `select public.create_market(
       $1, '', 'campus'::public.market_category, $2,
       $3::timestamptz, $4::timestamptz, '["Yes","No"]'::jsonb
     )`,
    [
      title,
      "Resolves from an official university announcement.",
      future(1),
      future(2),
    ],
  );
}

describe("0027 serialized market creation limits", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await bootTestDb(27);
    const userId = await createUser(db);
    await setUid(db, userId);
  });

  it("locks the creator before evaluating rate-limit counts", async () => {
    const result = await db.query<{ definition: string }>(
      `select pg_get_functiondef(
         'public.create_market(text,text,public.market_category,text,timestamptz,timestamptz,jsonb,boolean,boolean)'::regprocedure
       ) as definition`,
    );
    const definition = result.rows[0].definition.toLowerCase();
    const creatorLock = definition.indexOf("from public.profiles");
    const cooldownCount = definition.indexOf("select count(*) into v_recent_count");

    expect(creatorLock).toBeGreaterThan(-1);
    expect(definition.slice(creatorLock, cooldownCount)).toContain("for update");
    expect(creatorLock).toBeLessThan(cooldownCount);
  });

  it("still enforces the cooldown after a successful creation", async () => {
    await createMarket(db, "Will the first campus event happen?");

    await expect(
      createMarket(db, "Will the second campus event happen?"),
    ).rejects.toThrow("rate_limited: please wait");
  });

  it("still enforces the daily limit when the cooldown is disabled", async () => {
    await db.exec(
      `update public.app_config
       set int_val = case key
         when 'market_cooldown_seconds' then 0
         when 'market_daily_limit' then 2
         else int_val
       end
       where key in ('market_cooldown_seconds', 'market_daily_limit')`,
    );

    await createMarket(db, "Will the first daily market happen?");
    await createMarket(db, "Will the second daily market happen?");

    await expect(
      createMarket(db, "Will the third daily market happen?"),
    ).rejects.toThrow("rate_limited: daily market creation limit reached");
  });
});
