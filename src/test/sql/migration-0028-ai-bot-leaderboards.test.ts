import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  applyMigration,
  bootTestDb,
  createAdmin,
  createUser,
  setUid,
} from "./harness";

interface Outcome {
  id: string;
}

interface CreateResult {
  market_id: string;
  outcomes: Outcome[];
}

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

describe("0028 AI bot leaderboard exclusion", () => {
  let db: PGlite;
  let admin: string;
  let human: string;
  let bot: string;
  let semesterId: string;
  let market: CreateResult;

  beforeEach(async () => {
    db = await bootTestDb(26);
    admin = await createAdmin(db);
    human = await createUser(db);
    bot = await createUser(db, "husky.bot.1@northeastern.edu");

    await setUid(db, admin);
    const created = await db.query<{ market: CreateResult }>(
      `select public.create_market(
         'AI leaderboard regression',
         null,
         'campus'::public.market_category,
         'Resolves from an official published result.',
         $1::timestamptz,
         $2::timestamptz,
         '["Yes", "No"]'::jsonb,
         false
       ) as market`,
      [future(1), future(2)],
    );
    market = created.rows[0].market;

    await db.query(
      `insert into public.ai_trade_log
         (bot_user_id, market_id, action, reasoning)
       values ($1, $2, 'skip', 'existing automated trader')`,
      [bot, market.market_id],
    );

    await applyMigration(
      db,
      "0028_exclude_ai_bots_from_leaderboards.sql",
    );

    const semester = await db.query<{ id: string }>(
      `select id
       from public.semesters
       where starts_at <= now() and ends_at > now()
       limit 1`,
    );
    semesterId = semester.rows[0].id;
  });

  it("backfills existing bots without exposing the marker to client updates", async () => {
    const profiles = await db.query<{ id: string; is_ai_bot: boolean }>(
      `select id, is_ai_bot
       from public.profiles
       where id in ($1, $2)
       order by id`,
      [human, bot],
    );

    expect(
      profiles.rows.find((profile) => profile.id === bot)?.is_ai_bot,
    ).toBe(true);
    expect(
      profiles.rows.find((profile) => profile.id === human)?.is_ai_bot,
    ).toBe(false);

    const privilege = await db.query<{ allowed: boolean }>(
      `select has_column_privilege(
         'authenticated',
         'public.profiles',
         'is_ai_bot',
         'UPDATE'
       ) as allowed`,
    );
    expect(privilege.rows[0].allowed).toBe(false);
  });

  it("excludes bots from live boards and Hall of Fame snapshots", async () => {
    for (let i = 0; i < 10; i++) {
      await setUid(db, human);
      await db.query("select public.place_bet($1, $2, 10)", [
        market.market_id,
        market.outcomes[0].id,
      ]);

      await setUid(db, bot);
      await db.query("select public.place_bet($1, $2, 10)", [
        market.market_id,
        market.outcomes[0].id,
      ]);
    }

    await setUid(db, admin);
    const semesterBoard = await db.query<{ user_id: string }>(
      "select * from public.get_semester_leaderboard($1)",
      [semesterId],
    );
    expect(semesterBoard.rows.some((row) => row.user_id === human)).toBe(true);
    expect(semesterBoard.rows.some((row) => row.user_id === bot)).toBe(false);

    await db.query("select public.resolve_market($1, 'resolve', $2)", [
      market.market_id,
      market.outcomes[0].id,
    ]);

    const accuracyBoard = await db.query<{ user_id: string }>(
      "select * from public.get_accuracy_leaderboard($1)",
      [semesterId],
    );
    expect(accuracyBoard.rows.some((row) => row.user_id === human)).toBe(true);
    expect(accuracyBoard.rows.some((row) => row.user_id === bot)).toBe(false);

    await db.query("select public.snapshot_semester($1)", [semesterId]);
    const hallOfFame = await db.query<{ user_id: string }>(
      "select user_id from public.hall_of_fame where semester_id = $1",
      [semesterId],
    );
    expect(hallOfFame.rows.some((row) => row.user_id === human)).toBe(true);
    expect(hallOfFame.rows.some((row) => row.user_id === bot)).toBe(false);
  });
});
