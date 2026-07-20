import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, threads } from "@/db/schema";

export async function findOwnedProject(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return project ?? null;
}

export async function findOwnedThread(userId: string, threadId: string) {
  const [row] = await db
    .select({ thread: threads, project: projects })
    .from(threads)
    .innerJoin(projects, eq(threads.projectId, projects.id))
    .where(and(eq(threads.id, threadId), eq(projects.ownerId, userId)))
    .limit(1);
  return row ?? null;
}
