import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb } from "./harness";

interface PolicyRow {
  policyname: string;
  qual: string;
}

describe("migration 0027 - hidden market bettor access", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await bootTestDb(27);
  });

  it("keeps authenticated bettors in the market visibility policy", async () => {
    const result = await db.query<PolicyRow>(
      `select policyname, qual
       from pg_policies
       where schemaname = 'public'
         and tablename = 'markets'
         and policyname = 'markets: visible unless hidden or pending'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].qual).toMatch(/bets/);
    expect(result.rows[0].qual).toMatch(/b\.market_id = markets\.id/);
    expect(result.rows[0].qual).toMatch(/b\.user_id/);
    expect(result.rows[0].qual).toMatch(/auth\.uid\(\)/);
  });

  it("keeps the outcomes needed to render a bettor's position visible", async () => {
    const result = await db.query<PolicyRow>(
      `select policyname, qual
       from pg_policies
       where schemaname = 'public'
         and tablename = 'market_outcomes'
         and policyname = 'market_outcomes: visible with parent market'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].qual).toMatch(/bets/);
    expect(result.rows[0].qual).toMatch(/b\.market_id = m\.id/);
    expect(result.rows[0].qual).toMatch(/b\.user_id/);
    expect(result.rows[0].qual).toMatch(/auth\.uid\(\)/);
  });

  it("does not broaden the anonymous hidden-market policy", async () => {
    const result = await db.query<PolicyRow>(
      `select policyname, qual
       from pg_policies
       where schemaname = 'public'
         and tablename = 'markets'
         and policyname = 'markets: anon read visible'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].qual).toMatch(/hidden = false/);
    expect(result.rows[0].qual).not.toMatch(/bets/);
  });
});
