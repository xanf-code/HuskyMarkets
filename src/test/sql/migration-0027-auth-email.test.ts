import { describe, expect, it } from "vitest";
import { bootTestDb, createUser } from "./harness";

describe("0027 auth email updates", () => {
  it("rejects an email change outside the Northeastern domain atomically", async () => {
    const db = await bootTestDb(27);
    const userId = await createUser(db, "student@northeastern.edu");

    await expect(
      db.query("update auth.users set email = $1 where id = $2", [
        "outsider@example.com",
        userId,
      ]),
    ).rejects.toThrow(/restricted to @northeastern\.edu accounts/i);

    const authUser = await db.query<{ email: string }>(
      "select email from auth.users where id = $1",
      [userId],
    );
    const profile = await db.query<{ email: string }>(
      "select email from public.profiles where id = $1",
      [userId],
    );

    expect(authUser.rows[0].email).toBe("student@northeastern.edu");
    expect(profile.rows[0].email).toBe("student@northeastern.edu");
  });

  it("synchronizes an accepted campus email change to the profile", async () => {
    const db = await bootTestDb(27);
    const userId = await createUser(db, "student@northeastern.edu");

    await db.query("update auth.users set email = $1 where id = $2", [
      "NEW.STUDENT@NORTHEASTERN.EDU",
      userId,
    ]);

    const profile = await db.query<{ email: string }>(
      "select email from public.profiles where id = $1",
      [userId],
    );

    expect(profile.rows[0].email).toBe("new.student@northeastern.edu");
  });

  it("rolls back an email change that would orphan a duplicate profile email", async () => {
    const db = await bootTestDb(27);
    const firstUserId = await createUser(db, "first@northeastern.edu");
    await createUser(db, "second@northeastern.edu");

    await expect(
      db.query("update auth.users set email = $1 where id = $2", [
        "second@northeastern.edu",
        firstUserId,
      ]),
    ).rejects.toThrow(/unique/i);

    const authUser = await db.query<{ email: string }>(
      "select email from auth.users where id = $1",
      [firstUserId],
    );
    const profile = await db.query<{ email: string }>(
      "select email from public.profiles where id = $1",
      [firstUserId],
    );

    expect(authUser.rows[0].email).toBe("first@northeastern.edu");
    expect(profile.rows[0].email).toBe("first@northeastern.edu");
  });
});
