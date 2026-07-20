import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function ensureAppUser(userId: string) {
  const result = await db.execute<{ deleted_at: Date | null }>(sql`
    with inserted as (
      insert into ${users} (id)
      values (${userId})
      on conflict (id) do nothing
      returning deleted_at
    )
    select deleted_at from inserted
    union all
    select deleted_at from ${users} where id = ${userId}
    limit 1
  `);
  return result.rows[0]?.deleted_at === null;
}

export async function updateAppUser(input: {
  id: string;
  email?: string | null;
  displayName?: string | null;
  imageUrl?: string | null;
}) {
  await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      displayName: input.displayName,
      imageUrl: input.imageUrl,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
}

export async function softDeleteAppUser(userId: string) {
  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}
