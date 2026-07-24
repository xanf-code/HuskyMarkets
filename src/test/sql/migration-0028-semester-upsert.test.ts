import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  bootTestDb,
  createAdmin,
  createUser,
  setUid,
} from "./harness";

describe("0028 semester upsert RPC", () => {
  let db: PGlite;
  let adminId: string;

  beforeEach(async () => {
    db = await bootTestDb(28);
    adminId = await createAdmin(db);
  });

  it("lets admins create and edit semesters", async () => {
    await setUid(db, adminId);
    const created = await db.query<{ id: string }>(
      `select public.upsert_semester(
         ' Spring 2027 ',
         '2027-01-10T05:00:00Z',
         '2027-04-30T04:00:00Z'
       ) as id`,
    );
    const semesterId = created.rows[0].id;

    const inserted = await db.query<{
      name: string;
      starts_at: string;
      ends_at: string;
    }>(
      "select name, starts_at, ends_at from public.semesters where id = $1",
      [semesterId],
    );
    expect(inserted.rows[0].name).toBe("Spring 2027");

    const updated = await db.query<{ id: string }>(
      `select public.upsert_semester(
         'Spring 2027 Extended',
         '2027-01-10T05:00:00Z',
         '2027-05-01T04:00:00Z',
         $1
       ) as id`,
      [semesterId],
    );
    expect(updated.rows[0].id).toBe(semesterId);

    const name = await db.query<{ name: string }>(
      "select name from public.semesters where id = $1",
      [semesterId],
    );
    expect(name.rows[0].name).toBe("Spring 2027 Extended");
  });

  it("rejects non-admin callers", async () => {
    const userId = await createUser(db);
    await setUid(db, userId);

    await expect(
      db.query(
        `select public.upsert_semester(
           'Fall 2026',
           '2026-09-01T04:00:00Z',
           '2026-12-20T05:00:00Z'
         )`,
      ),
    ).rejects.toThrow(/admin only/i);
  });

  it("keeps direct table writes revoked while granting only authenticated RPC access", async () => {
    const privileges = await db.query<{
      auth_insert: boolean;
      auth_update: boolean;
      auth_execute: boolean;
      anon_execute: boolean;
    }>(
      `select
         has_table_privilege('authenticated', 'public.semesters', 'INSERT') as auth_insert,
         has_table_privilege('authenticated', 'public.semesters', 'UPDATE') as auth_update,
         has_function_privilege(
           'authenticated',
           'public.upsert_semester(text,timestamptz,timestamptz,uuid)',
           'EXECUTE'
         ) as auth_execute,
         has_function_privilege(
           'anon',
           'public.upsert_semester(text,timestamptz,timestamptz,uuid)',
           'EXECUTE'
         ) as anon_execute`,
    );

    expect(privileges.rows[0]).toEqual({
      auth_insert: false,
      auth_update: false,
      auth_execute: true,
      anon_execute: false,
    });
  });
});
