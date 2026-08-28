import { afterEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootTestDb } from "./harness";

describe("migration 0027 - anonymous handle capacity", () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
  });

  it("allocates a handle after every legacy two-digit combination is occupied", async () => {
    db = await bootTestDb(27);

    await db.exec(`
      alter table auth.users disable trigger on_auth_user_created;

      insert into auth.users (id, email)
      select
        ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
        'legacy' || i || '@northeastern.edu'
      from generate_series(0, 1999) as g(i);

      with adjectives as (
        select adjective, adjective_index
        from unnest(array[
          'Swift', 'Clever', 'Bold', 'Quiet', 'Lucky', 'Frosty', 'Midnight',
          'Scrappy', 'Nimble', 'Cosmic', 'Turbo', 'Sneaky', 'Mighty', 'Rowdy',
          'Chill', 'Blazing', 'Crimson', 'Shadow', 'Electric', 'Wandering'
        ]) with ordinality as a(adjective, adjective_index)
      )
      insert into public.profiles (id, email, anon_handle)
      select
        ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
        'legacy' || i || '@northeastern.edu',
        adjective || 'Husky' || lpad(suffix::text, 2, '0')
      from adjectives
      cross join generate_series(0, 99) as numbers(suffix)
      cross join lateral (
        select ((adjective_index - 1) * 100 + suffix)::integer as i
      ) as profile_number;
    `);

    await db.exec(
      "alter table auth.users enable trigger on_auth_user_created",
    );
    const signup = await db.query<{ id: string }>(
      `insert into auth.users (email)
       values ('next-user@northeastern.edu')
       returning id`,
    );
    const profile = await db.query<{ handle: string }>(
      "select anon_handle as handle from public.profiles where id = $1",
      [signup.rows[0].id],
    );
    const handle = profile.rows[0].handle;

    expect(handle).toMatch(/^[A-Za-z]+Husky\d{6}$/);
  }, 30_000);
});
