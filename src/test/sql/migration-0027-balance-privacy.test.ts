import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb } from "./harness";

describe("migration 0027 - balance privacy", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await bootTestDb(27);
  });

  it("prevents clients from looking up arbitrary users' balances", async () => {
    for (const role of ["public", "anon", "authenticated"]) {
      const result = await db.query<{ allowed: boolean }>(
        `select has_function_privilege(
          $1,
          'public.get_balance(uuid)',
          'execute'
        ) as allowed`,
        [role],
      );

      expect(result.rows[0].allowed).toBe(false);
    }
  });

  it("keeps the caller-scoped balance RPC available to authenticated users", async () => {
    const result = await db.query<{ allowed: boolean }>(
      `select has_function_privilege(
        'authenticated',
        'public.get_my_balance()',
        'execute'
      ) as allowed`,
    );

    expect(result.rows[0].allowed).toBe(true);
  });
});
