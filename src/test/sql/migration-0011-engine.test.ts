// E-1 / S1-4, S1-5 — engine RPCs (create_market, place_bet, resolve_market)
// and verify_ledger_invariant, exercised on the migrated N-outcome schema.

import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb, createUser, createAdmin, setUid } from "./harness";

interface Outcome {
  id: string;
  label: string;
  sort_order: number;
  pool: number;
  implied: number;
}
interface CreateResult {
  market_id: string;
  outcomes: Outcome[];
}
interface BetFill {
  bet_id: string;
  outcomes: Outcome[];
  new_balance: number;
}

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

async function createMarket(
  db: PGlite,
  uid: string,
  outcomes: string[] = ["Yes", "No"],
  catchAll = false,
): Promise<CreateResult> {
  await setUid(db, uid);
  const r = await db.query<{ m: CreateResult }>(
    `select public.create_market(
       $1, $2, $3::public.market_category, $4,
       $5::timestamptz, $6::timestamptz, $7::jsonb, $8) as m`,
    [
      "Will something happen on campus?",
      null,
      "campus",
      "Resolves when the thing is officially confirmed.",
      future(1),
      future(2),
      JSON.stringify(outcomes),
      catchAll,
    ],
  );
  return r.rows[0].m;
}

async function placeBet(
  db: PGlite,
  uid: string,
  marketId: string,
  outcomeId: string,
  amount: number,
): Promise<BetFill> {
  await setUid(db, uid);
  const r = await db.query<{ r: BetFill }>(
    "select public.place_bet($1, $2, $3) as r",
    [marketId, outcomeId, amount],
  );
  return r.rows[0].r;
}

async function balance(db: PGlite, uid: string): Promise<number> {
  const r = await db.query<{ b: number }>(
    "select public.get_balance($1) as b",
    [uid],
  );
  return r.rows[0].b;
}

describe("create_market", () => {
  let db: PGlite;
  let uid: string;
  beforeEach(async () => {
    db = await bootTestDb();
    uid = await createUser(db);
  });

  it("atomically creates a market with N outcomes seeded at 100 HC", async () => {
    const res = await createMarket(db, uid, ["Alpha", "Beta", "Gamma"]);
    expect(res.outcomes).toHaveLength(3);
    expect(res.outcomes.map((o) => o.label)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(res.outcomes.map((o) => o.sort_order)).toEqual([0, 1, 2]);
    expect(res.outcomes.every((o) => o.pool === 100)).toBe(true);
    // 1/3 each → round(100/3) = 33
    expect(res.outcomes.every((o) => o.implied === 33)).toBe(true);

    const count = await db.query<{ n: number }>(
      "select count(*)::int as n from public.market_outcomes where market_id = $1",
      [res.market_id],
    );
    expect(count.rows[0].n).toBe(3);
  });

  it("appends the catch-all as the final outcome within the 6 max", async () => {
    const res = await createMarket(db, uid, ["A", "B", "C", "D", "E"], true);
    expect(res.outcomes).toHaveLength(6);
    expect(res.outcomes[5].label.toLowerCase()).toContain("none of the above");
  });

  it("rejects fewer than 2 outcomes", async () => {
    await expect(createMarket(db, uid, ["Solo"])).rejects.toThrow();
  });

  it("rejects more than 6 outcomes", async () => {
    await expect(
      createMarket(db, uid, ["1", "2", "3", "4", "5", "6", "7"]),
    ).rejects.toThrow();
  });

  it("rejects 5 labels + catch-all = 7 over the max", async () => {
    await expect(
      createMarket(db, uid, ["1", "2", "3", "4", "5", "6"], true),
    ).rejects.toThrow();
  });

  it("rejects case-insensitive duplicate labels", async () => {
    await expect(createMarket(db, uid, ["Yes", "yes"])).rejects.toThrow();
  });

  it("rejects an empty/whitespace label", async () => {
    await expect(createMarket(db, uid, ["Yes", "   "])).rejects.toThrow();
  });

  it("rejects a label longer than 40 chars", async () => {
    await expect(
      createMarket(db, uid, ["Yes", "x".repeat(41)]),
    ).rejects.toThrow();
  });

  it("rejects a creator label colliding with the catch-all", async () => {
    await expect(
      createMarket(db, uid, ["None of the above", "Other"], true),
    ).rejects.toThrow();
  });

  it("W3: treats labels that differ only in interior whitespace as duplicates", async () => {
    // "A  B" and "A B" must collide after interior-whitespace normalization.
    await expect(createMarket(db, uid, ["A  B", "A B"])).rejects.toThrow();
  });
});

describe("place_bet", () => {
  let db: PGlite;
  let creator: string;
  let bettor: string;
  beforeEach(async () => {
    db = await bootTestDb();
    creator = await createUser(db);
    bettor = await createUser(db);
  });

  it("returns the full outcome map and the new balance", async () => {
    const m = await createMarket(db, creator, ["Alpha", "Beta", "Gamma"]);
    const fill = await placeBet(db, bettor, m.market_id, m.outcomes[0].id, 50);
    expect(fill.outcomes).toHaveLength(3);
    expect(fill.outcomes.map((o) => o.sort_order)).toEqual([0, 1, 2]);
    const alpha = fill.outcomes.find((o) => o.id === m.outcomes[0].id)!;
    expect(alpha.pool).toBe(150); // 100 seed + 50
    expect(fill.new_balance).toBe(950); // 1000 - 50
  });

  it("prices the bet at the chosen outcome's implied price before the stake", async () => {
    const m = await createMarket(db, creator, ["Yes", "No"]);
    await placeBet(db, bettor, m.market_id, m.outcomes[0].id, 100);
    const bet = await db.query<{ price_at_bet: number }>(
      "select price_at_bet from public.bets where market_id = $1 limit 1",
      [m.market_id],
    );
    expect(bet.rows[0].price_at_bet).toBe(50); // 100/(100+100) before stake
  });

  it("snapshots one price_history row per outcome after the bet", async () => {
    const m = await createMarket(db, creator, ["A", "B", "C", "D"]);
    await placeBet(db, bettor, m.market_id, m.outcomes[0].id, 20);
    const rows = await db.query<{ n: number }>(
      `select count(*)::int as n from public.price_history
       where market_id = $1 and recorded_at = (
         select max(recorded_at) from public.price_history where market_id = $1)`,
      [m.market_id],
    );
    expect(rows.rows[0].n).toBe(4);
  });

  it("enforces the 500 HC cap as an aggregate across all outcomes", async () => {
    const m = await createMarket(db, creator, ["A", "B", "C"]);
    await placeBet(db, bettor, m.market_id, m.outcomes[0].id, 300);
    await placeBet(db, bettor, m.market_id, m.outcomes[1].id, 199); // 499 total ok
    await expect(
      placeBet(db, bettor, m.market_id, m.outcomes[2].id, 2),
    ).rejects.toThrow(/cap/i);
  });

  it("rejects an outcome from a different market", async () => {
    const m1 = await createMarket(db, creator, ["A", "B"]);
    const m2 = await createMarket(db, creator, ["C", "D"]);
    await expect(
      placeBet(db, bettor, m1.market_id, m2.outcomes[0].id, 10),
    ).rejects.toThrow(/outcome does not belong/i);
  });

  it("rejects bets on a non-open market", async () => {
    const m = await createMarket(db, creator, ["A", "B"]);
    await db.exec(
      `update public.markets set status = 'closed' where id = '${m.market_id}'`,
    );
    await expect(
      placeBet(db, bettor, m.market_id, m.outcomes[0].id, 10),
    ).rejects.toThrow(/closed/i);
  });
});

describe("resolve_market", () => {
  let db: PGlite;
  let admin: string;
  let a: string;
  let b: string;
  beforeEach(async () => {
    db = await bootTestDb();
    admin = await createAdmin(db);
    a = await createUser(db);
    b = await createUser(db);
  });

  it("pays the winning pool pro-rata after 5% vig, burning the rest", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 100); // Yes
    await placeBet(db, b, m.market_id, m.outcomes[1].id, 100); // No
    // pools: Yes 200, No 200, total 400. vig = 20, after = 380.
    // Yes wins; winning pool 200; a's stake 100 → floor(100*380/200)=190.
    await setUid(db, admin);
    const r = await db.query<{ r: { status: string; paid_out: number; burned: number } }>(
      "select public.resolve_market($1, 'resolve', $2) as r",
      [m.market_id, m.outcomes[0].id],
    );
    expect(r.rows[0].r.status).toBe("resolved");
    expect(r.rows[0].r.paid_out).toBe(190);
    expect(r.rows[0].r.burned).toBe(210); // 400 - 190
    expect(await balance(db, a)).toBe(1000 - 100 + 190);
    const mk = await db.query<{ w: string }>(
      "select winning_outcome_id as w from public.markets where id = $1",
      [m.market_id],
    );
    expect(mk.rows[0].w).toBe(m.outcomes[0].id);
  });

  it("records the winning outcome on the mod_actions audit row", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 50);
    await setUid(db, admin);
    await db.query("select public.resolve_market($1, 'resolve', $2)", [
      m.market_id,
      m.outcomes[0].id,
    ]);
    const act = await db.query<{ action: string; outcome_id: string }>(
      "select action::text, outcome_id from public.mod_actions where market_id = $1 and action = 'resolve'",
      [m.market_id],
    );
    expect(act.rows[0].action).toBe("resolve");
    expect(act.rows[0].outcome_id).toBe(m.outcomes[0].id);
  });

  it("refunds all stakes on void with no burn", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 100);
    await placeBet(db, b, m.market_id, m.outcomes[1].id, 40);
    await setUid(db, admin);
    const r = await db.query<{ r: { status: string; refunded: number; burned: number } }>(
      "select public.resolve_market($1, 'void', null) as r",
      [m.market_id],
    );
    expect(r.rows[0].r.status).toBe("voided");
    expect(r.rows[0].r.burned).toBe(0);
    expect(await balance(db, a)).toBe(1000);
    expect(await balance(db, b)).toBe(1000);
  });

  it("refunds when the winning outcome has no stake (empty-winner)", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 100); // only Yes backed
    await setUid(db, admin);
    // Resolve No (nobody backed it) → refund path, no burn.
    const r = await db.query<{ r: { status: string; burned: number } }>(
      "select public.resolve_market($1, 'resolve', $2) as r",
      [m.market_id, m.outcomes[1].id],
    );
    expect(r.rows[0].r.status).toBe("resolved");
    expect(r.rows[0].r.burned).toBe(0);
    expect(await balance(db, a)).toBe(1000); // refunded
  });

  it("requires a winning outcome when action = resolve", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await setUid(db, admin);
    await expect(
      db.query("select public.resolve_market($1, 'resolve', null)", [
        m.market_id,
      ]),
    ).rejects.toThrow();
  });

  it("rejects a winning outcome from a different market", async () => {
    const m1 = await createMarket(db, admin, ["Yes", "No"]);
    const m2 = await createMarket(db, admin, ["Yes", "No"]);
    await setUid(db, admin);
    await expect(
      db.query("select public.resolve_market($1, 'resolve', $2)", [
        m1.market_id,
        m2.outcomes[0].id,
      ]),
    ).rejects.toThrow();
  });
});

describe("verify_ledger_invariant", () => {
  let db: PGlite;
  let admin: string;
  let a: string;
  let b: string;
  let c: string;
  beforeEach(async () => {
    db = await bootTestDb();
    admin = await createAdmin(db);
    a = await createUser(db);
    b = await createUser(db);
    c = await createUser(db);
  });

  async function invariant(): Promise<{ balanced: boolean; delta: number }> {
    await setUid(db, admin);
    const r = await db.query<{ v: { balanced: boolean; delta: number } }>(
      "select public.verify_ledger_invariant() as v",
    );
    return r.rows[0].v;
  }

  it("balances across a 2/3/4-outcome mix including a voided market", async () => {
    // 2-outcome resolved
    const m2 = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m2.market_id, m2.outcomes[0].id, 120);
    await placeBet(db, b, m2.market_id, m2.outcomes[1].id, 80);
    // 3-outcome resolved
    const m3 = await createMarket(db, admin, ["A", "B", "C"]);
    await placeBet(db, a, m3.market_id, m3.outcomes[1].id, 60);
    await placeBet(db, c, m3.market_id, m3.outcomes[1].id, 90);
    // 4-outcome voided
    const m4 = await createMarket(db, admin, ["W", "X", "Y", "Z"]);
    await placeBet(db, b, m4.market_id, m4.outcomes[2].id, 200);

    await setUid(db, admin);
    await db.query("select public.resolve_market($1,'resolve',$2)", [
      m2.market_id,
      m2.outcomes[0].id,
    ]);
    await db.query("select public.resolve_market($1,'resolve',$2)", [
      m3.market_id,
      m3.outcomes[1].id,
    ]);
    await db.query("select public.resolve_market($1,'void',null)", [
      m4.market_id,
    ]);

    const inv = await invariant();
    expect(inv.delta).toBe(0);
    expect(inv.balanced).toBe(true);
  });

  it("stays balanced when a resolved market had an empty winner (no seed injected)", async () => {
    // Only Yes is backed; resolving No takes the refund path — no vig_burn, so
    // the seed never enters the ledger and must be excluded from the seed term.
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 75);
    await setUid(db, admin);
    await db.query("select public.resolve_market($1,'resolve',$2)", [
      m.market_id,
      m.outcomes[1].id, // No — nobody backed it
    ]);
    const inv = await invariant();
    expect(inv.delta).toBe(0);
    expect(inv.balanced).toBe(true);
  });

  it("detects an injected imbalance (spurious vig_burn)", async () => {
    const m = await createMarket(db, admin, ["Yes", "No"]);
    await placeBet(db, a, m.market_id, m.outcomes[0].id, 50);
    await setUid(db, admin);
    await db.query("select public.resolve_market($1,'resolve',$2)", [
      m.market_id,
      m.outcomes[0].id,
    ]);
    expect((await invariant()).balanced).toBe(true);

    await db.exec(
      "insert into public.transactions (user_id, type, amount) values (null, 'vig_burn', 7)",
    );
    const inv = await invariant();
    expect(inv.balanced).toBe(false);
    expect(inv.delta).toBe(7);
  });
});
