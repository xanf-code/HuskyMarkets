import { describe, it, expect } from "vitest";
import { bootTestDb, createUser } from "./harness";

describe("pglite harness", () => {
  it("boots the migration stack and mints a profile + grant", async () => {
    const db = await bootTestDb(10);
    const uid = await createUser(db);
    const bal = await db.query<{ b: number }>(
      "select public.get_balance($1) as b",
      [uid],
    );
    expect(bal.rows[0].b).toBe(1000);
    await db.close();
  });
});
