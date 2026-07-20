import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { projects, threads, users } from "@/db/schema";

async function seed() {
  const userId = process.env.SEED_CLERK_USER_ID;
  if (!userId) {
    throw new Error("SEED_CLERK_USER_ID is required; use a real Clerk test user ID");
  }

  await db
    .insert(users)
    .values({ id: userId, displayName: "Stitch Talk Test User" })
    .onConflictDoUpdate({
      target: users.id,
      set: { deletedAt: null, updatedAt: new Date() },
    });

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.ownerId, userId), eq(projects.name, "Aurora Health")),
  });

  const project =
    existing ??
    (
      await db
        .insert(projects)
        .values({
          ownerId: userId,
          name: "Aurora Health",
          blurb: "Calm clinical app for first-time patients",
          accent: "teal",
        })
        .returning()
    )[0];

  const existingThread = await db.query.threads.findFirst({
    where: and(
      eq(threads.projectId, project.id),
      eq(threads.title, "Direction from first principles"),
    ),
  });

  if (!existingThread) {
    await db.insert(threads).values({
      projectId: project.id,
      title: "Direction from first principles",
    });
  }

  console.log(`Seeded development data for ${userId}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
