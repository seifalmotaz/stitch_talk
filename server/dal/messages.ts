import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, messages, projects, threads } from "@/db/schema";
import { deriveThreadTitle } from "@/server/dal/format";
import { findOwnedThread } from "@/server/dal/ownership";
import { reconcileStaleAssistant } from "@/server/dal/reconciliation";
import { getObjectAsDataUrl } from "@/server/storage";
import type { WireMessage } from "@/types/chat";

export async function startTurn(
  userId: string,
  input: {
    threadId: string;
    requestId: string;
    content: string;
    attachmentIds: string[];
  },
) {
  await reconcileStaleAssistant(input.threadId);
  try {
    return await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ thread: threads, project: projects })
      .from(threads)
      .innerJoin(projects, eq(threads.projectId, projects.id))
      .where(
        and(eq(threads.id, input.threadId), eq(projects.ownerId, userId)),
      )
      .for("update")
      .limit(1);
    if (!owned) return null;

    const existing = await tx
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.threadId, input.threadId),
          eq(messages.requestId, input.requestId),
        ),
      );
    if (existing.length > 0) {
      const userMessage = existing.find((message) => message.role === "user");
      const assistantMessage = existing.find(
        (message) => message.role === "assistant",
      );
      if (!userMessage || !assistantMessage) {
        throw new Error("Incomplete idempotent chat turn");
      }
      return {
        created: false as const,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        assistantStatus: assistantMessage.status,
        assistantContent: assistantMessage.content,
      };
    }

    let attachmentRows: (typeof attachments.$inferSelect)[] = [];
    if (input.attachmentIds.length > 0) {
      attachmentRows = await tx
        .select()
        .from(attachments)
        .where(inArray(attachments.id, input.attachmentIds));
      const allValid =
        attachmentRows.length === input.attachmentIds.length &&
        attachmentRows.every(
          (attachment) =>
            attachment.ownerId === userId &&
            attachment.threadId === input.threadId &&
            attachment.status === "ready" &&
            attachment.messageId === null,
        );
      if (!allValid) throw new Error("Invalid or unavailable attachment");
    }

    const ordinal = owned.thread.nextOrdinal;
    const [userMessage] = await tx
      .insert(messages)
      .values({
        threadId: input.threadId,
        ordinal,
        role: "user",
        content: input.content,
        status: "complete",
        requestId: input.requestId,
        finishedAt: new Date(),
      })
      .returning();
    const [assistantMessage] = await tx
      .insert(messages)
      .values({
        threadId: input.threadId,
        ordinal: ordinal + 1,
        role: "assistant",
        status: "streaming",
        requestId: input.requestId,
      })
      .returning();

    for (const [position, attachment] of attachmentRows.entries()) {
      await tx
        .update(attachments)
        .set({
          messageId: userMessage.id,
          status: "attached",
          position,
          attachedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(attachments.id, attachment.id));
    }

    const firstTitle =
      owned.thread.title === "New thread" && input.content.trim()
        ? deriveThreadTitle(input.content)
        : owned.thread.title;
    await tx
      .update(threads)
      .set({
        nextOrdinal: ordinal + 2,
        title: firstTitle,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, input.threadId));
    await tx
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, owned.project.id));

      return {
        created: true as const,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        assistantStatus: assistantMessage.status,
        assistantContent: "",
      };
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      const existing = await findTurnByRequest(input.threadId, input.requestId);
      if (existing) return existing;
    }
    throw error;
  }
}

async function findTurnByRequest(threadId: string, requestId: string) {
  const existing = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.threadId, threadId),
        eq(messages.requestId, requestId),
      ),
    );
  const userMessage = existing.find((message) => message.role === "user");
  const assistantMessage = existing.find(
    (message) => message.role === "assistant",
  );
  if (!userMessage || !assistantMessage) return null;
  return {
    created: false as const,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    assistantStatus: assistantMessage.status,
    assistantContent: assistantMessage.content,
  };
}

export async function checkpointAssistant(
  userId: string,
  assistantMessageId: string,
  content: string,
) {
  const [updated] = await db
    .update(messages)
    .set({ content, updatedAt: new Date() })
    .where(
      and(
        eq(messages.id, assistantMessageId),
        eq(messages.status, "streaming"),
        ownedMessageExists(userId),
      ),
    )
    .returning({ id: messages.id });
  return Boolean(updated);
}

export async function finishAssistant(
  userId: string,
  assistantMessageId: string,
  input: {
    content: string;
    status: "complete" | "failed" | "cancelled";
    errorCode?: string;
    errorDetail?: string;
  },
) {
  const [updated] = await db
    .update(messages)
    .set({
      content: input.content,
      status: input.status,
      errorCode: input.errorCode,
      errorDetail: input.errorDetail,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(messages.id, assistantMessageId),
        eq(messages.status, "streaming"),
        ownedMessageExists(userId),
      ),
    )
    .returning({ id: messages.id });
  return Boolean(updated);
}

export async function cancelTurn(
  userId: string,
  threadId: string,
  requestId: string,
) {
  const owned = await findOwnedThread(userId, threadId);
  if (!owned) return null;
  const [message] = await db
    .update(messages)
    .set({
      status: "cancelled",
      errorCode: "cancelled_by_user",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(messages.threadId, threadId),
        eq(messages.requestId, requestId),
        eq(messages.role, "assistant"),
        eq(messages.status, "streaming"),
      ),
    )
    .returning({ id: messages.id });
  return { cancelled: Boolean(message) };
}

export async function loadModelTranscript(
  userId: string,
  threadId: string,
): Promise<WireMessage[] | null> {
  const owned = await findOwnedThread(userId, threadId);
  if (!owned) return null;

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.ordinal);
  const usable = messageRows.filter(
    (message) =>
      message.content.trim().length > 0 &&
      !(message.role === "assistant" && message.status === "streaming"),
  );
  const userMessageIds = usable
    .filter((message) => message.role === "user")
    .map((message) => message.id);
  const imageRows =
    userMessageIds.length === 0
      ? []
      : await db
          .select()
          .from(attachments)
          .where(
            and(
              inArray(attachments.messageId, userMessageIds),
              eq(attachments.status, "attached"),
            ),
          )
          .orderBy(attachments.position);

  const hydratedImages = await Promise.all(
    imageRows.map(async (image) =>
      image.messageId
        ? {
            messageId: image.messageId,
            value: {
              dataUrl: await getObjectAsDataUrl(image.storageKey, image.mimeType),
              mimeType: image.mimeType,
              size: image.byteSize,
              name: image.originalName ?? undefined,
            },
          }
        : null,
    ),
  );
  const imagesByMessage = new Map<string, WireMessage["images"]>();
  for (const image of hydratedImages) {
    if (!image) continue;
    const list = imagesByMessage.get(image.messageId) ?? [];
    list.push(image.value);
    imagesByMessage.set(image.messageId, list);
  }

  return usable.map((message) => ({
    role: message.role,
    content: message.content,
    images:
      message.role === "user"
        ? imagesByMessage.get(message.id)
        : undefined,
  }));
}

function ownedMessageExists(userId: string) {
  return sql`exists (
    select 1
    from ${threads}
    inner join ${projects} on ${projects.id} = ${threads.projectId}
    where ${threads.id} = ${messages.threadId}
      and ${projects.ownerId} = ${userId}
  )`;
}
