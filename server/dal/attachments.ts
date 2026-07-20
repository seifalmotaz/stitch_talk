import "server-only";

import { and, count, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { findOwnedThread } from "@/server/dal/ownership";
import {
  assertValidUpload,
  createStorageKey,
  createUploadUrl,
  deleteStoredObject,
  inspectObject,
} from "@/server/storage";

const lastReapByUser = new Map<string, number>();
const REAP_INTERVAL_MS = 10 * 60 * 1000;

export async function prepareAttachment(
  userId: string,
  input: {
    threadId: string;
    originalName?: string;
    mimeType: string;
    byteSize: number;
  },
) {
  assertValidUpload(input);
  const owned = await findOwnedThread(userId, input.threadId);
  if (!owned) return null;

  const lastReap = lastReapByUser.get(userId) ?? 0;
  if (Date.now() - lastReap >= REAP_INTERVAL_MS) {
    lastReapByUser.set(userId, Date.now());
    await reapStalePendingUploads(userId);
  }
  const [pending] = await db
    .select({ total: count() })
    .from(attachments)
    .where(
      and(
        eq(attachments.ownerId, userId),
        eq(attachments.status, "pending"),
      ),
    );
  if (Number(pending?.total ?? 0) >= 20) {
    throw new Error("Too many pending image uploads; try again shortly");
  }

  const attachmentId = crypto.randomUUID();
  const storageKey = createStorageKey(attachmentId, input.mimeType);
  await db.insert(attachments).values({
    id: attachmentId,
    ownerId: userId,
    threadId: input.threadId,
    storageKey,
    originalName: input.originalName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
  });
  const uploadUrl = await createUploadUrl({
    storageKey,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
  });
  return { attachmentId, uploadUrl };
}

export async function completeAttachment(userId: string, attachmentId: string) {
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.ownerId, userId),
        eq(attachments.status, "pending"),
      ),
    )
    .limit(1);
  if (!attachment) return null;

  try {
    const stored = await inspectObject(attachment.storageKey);
    const valid =
      stored.byteSize === attachment.byteSize &&
      stored.mimeType === attachment.mimeType &&
      stored.signatureValid;
    if (!valid) {
      await deleteStoredObject(attachment.storageKey);
      await db
        .update(attachments)
        .set({ status: "orphaned", updatedAt: new Date() })
        .where(eq(attachments.id, attachment.id));
      throw new Error("Uploaded image did not match its declared metadata");
    }

    const [ready] = await db
      .update(attachments)
      .set({
        status: "ready",
        checksum: stored.etag,
        updatedAt: new Date(),
      })
      .where(eq(attachments.id, attachment.id))
      .returning({ id: attachments.id });
    return { attachmentId: ready.id };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Could not verify uploaded image");
  }
}

async function reapStalePendingUploads(userId: string) {
  const stale = await db
    .select({ id: attachments.id, storageKey: attachments.storageKey })
    .from(attachments)
    .where(
      and(
        eq(attachments.ownerId, userId),
        eq(attachments.status, "pending"),
        lt(attachments.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );

  if (stale.length === 0) return;
  await Promise.all(
    stale.map((attachment) =>
      deleteStoredObject(attachment.storageKey).catch(() => undefined),
    ),
  );
  await db
    .update(attachments)
    .set({ status: "orphaned", updatedAt: new Date() })
    .where(inArray(attachments.id, stale.map((attachment) => attachment.id)));
}
