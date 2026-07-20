import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, projects, threads } from "@/db/schema";
import type { ProjectAccent } from "@/db/schema";
import { findOwnedProject } from "@/server/dal/ownership";
import { relativeDate } from "@/server/dal/format";

export type ProjectDto = {
  id: string;
  name: string;
  blurb: string;
  accent: ProjectAccent;
  threadCount: number;
  updatedAt: string;
  updatedLabel: string;
};

export async function listProjects(userId: string): Promise<ProjectDto[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      blurb: projects.blurb,
      accent: projects.accent,
      updatedAt: projects.updatedAt,
      threadCount: sql<number>`count(${threads.id})`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(threads, eq(threads.projectId, projects.id))
    .where(eq(projects.ownerId, userId))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    updatedLabel: relativeDate(row.updatedAt),
  }));
}

export async function getProject(userId: string, projectId: string) {
  const project = await findOwnedProject(userId, projectId);
  if (!project) return null;
  return {
    id: project.id,
    name: project.name,
    blurb: project.blurb,
    accent: project.accent,
    updatedAt: project.updatedAt.toISOString(),
    updatedLabel: relativeDate(project.updatedAt),
  };
}

export async function createProject(
  userId: string,
  input: { name: string; blurb?: string; accent?: ProjectAccent },
) {
  const [project] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      name: input.name,
      blurb: input.blurb ?? "",
      accent: input.accent ?? "thread",
    })
    .returning();
  return { ...project, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() };
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: { name?: string; blurb?: string; accent?: ProjectAccent },
) {
  const [project] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .returning();
  return project ?? null;
}

export async function deleteProject(userId: string, projectId: string) {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
      .limit(1);
    if (!owned) return false;

    await tx
      .update(attachments)
      .set({ status: "orphaned", messageId: null, threadId: null, updatedAt: new Date() })
      .where(
        sql`${attachments.threadId} in (select id from ${threads} where ${threads.projectId} = ${projectId})`,
      );
    await tx.delete(projects).where(eq(projects.id, projectId));
    return true;
  });
}
