import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, messages, projects, threads } from "@/db/schema";
import { relativeDate } from "@/server/dal/format";
import { findOwnedProject, findOwnedThread } from "@/server/dal/ownership";
import { reconcileStaleAssistant } from "@/server/dal/reconciliation";
import { createDownloadUrl } from "@/server/storage";
import type { ChatImage } from "@/types/chat";

export type ThreadListDto = {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
  updatedLabel: string;
};

export async function listThreads(
  userId: string,
  projectId: string,
): Promise<ThreadListDto[] | null> {
  const project = await findOwnedProject(userId, projectId);
  if (!project) return null;

  const rows = await db
    .select({
      id: threads.id,
      title: threads.title,
      updatedAt: threads.updatedAt,
      messageCount:
        sql<number>`(select count(*) from messages m where m.thread_id = ${threads.id})`.mapWith(
          Number,
        ),
      preview: sql<string>`coalesce((select m.content from messages m where m.thread_id = ${threads.id} and length(m.content) > 0 order by m.ordinal desc limit 1), 'No messages yet')`,
    })
    .from(threads)
    .where(eq(threads.projectId, projectId))
    .orderBy(desc(threads.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    updatedLabel: relativeDate(row.updatedAt),
  }));
}

export async function createThread(userId: string, projectId: string) {
  const project = await findOwnedProject(userId, projectId);
  if (!project) return null;

  const [thread] = await db
    .insert(threads)
    .values({ projectId })
    .returning();
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  return { id: thread.id, title: thread.title };
}

export async function renameThread(
  userId: string,
  threadId: string,
  title: string,
) {
  const owned = await findOwnedThread(userId, threadId);
  if (!owned) return null;
  const [thread] = await db
    .update(threads)
    .set({ title, updatedAt: new Date() })
    .where(eq(threads.id, threadId))
    .returning();
  return thread ?? null;
}

export async function getThread(userId: string, threadId: string) {
  const owned = await findOwnedThread(userId, threadId);
  if (!owned) return null;

  await reconcileStaleAssistant(threadId);

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.ordinal);
  const messageIds = messageRows.map((message) => message.id);
  const attachmentRows =
    messageIds.length === 0
      ? []
      : await db
          .select()
          .from(attachments)
          .where(
            and(
              inArray(attachments.messageId, messageIds),
              eq(attachments.status, "attached"),
            ),
          )
          .orderBy(attachments.position);

  const attachmentsWithUrls = await Promise.all(
    attachmentRows.map(async (attachment) => ({
      id: attachment.id,
      messageId: attachment.messageId,
      dataUrl: await createDownloadUrl(attachment.storageKey),
      mimeType: attachment.mimeType,
      size: attachment.byteSize,
      name: attachment.originalName ?? undefined,
    })),
  );

  const attachmentsByMessage = new Map<string, ChatImage[]>();
  for (const attachment of attachmentsWithUrls) {
    if (!attachment.messageId) continue;
    const list = attachmentsByMessage.get(attachment.messageId) ?? [];
    list.push({
      dataUrl: attachment.dataUrl,
      mimeType: attachment.mimeType,
      size: attachment.size,
      name: attachment.name,
    });
    attachmentsByMessage.set(attachment.messageId, list);
  }

  return {
    id: owned.thread.id,
    title: owned.thread.title,
    projectId: owned.project.id,
    projectName: owned.project.name,
    messages: messageRows.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.getTime(),
      status: message.status,
      streaming: message.status === "streaming",
      error: message.status === "failed" || message.status === "cancelled",
      images: attachmentsByMessage.get(message.id) ?? [],
    })),
  };
}

export async function deleteThread(userId: string, threadId: string) {
  const owned = await findOwnedThread(userId, threadId);
  if (!owned) return false;

  await db.transaction(async (tx) => {
    await tx
      .update(attachments)
      .set({ status: "orphaned", messageId: null, threadId: null, updatedAt: new Date() })
      .where(eq(attachments.threadId, threadId));
    await tx.delete(threads).where(eq(threads.id, threadId));
  });
  return true;
}
