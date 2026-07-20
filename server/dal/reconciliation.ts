import "server-only";

import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";

export const STALE_STREAM_MS = 2 * 60 * 1000;

export async function reconcileStaleAssistant(threadId: string) {
  await db
    .update(messages)
    .set({
      status: "cancelled",
      errorCode: "stale_stream",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(messages.threadId, threadId),
        eq(messages.role, "assistant"),
        eq(messages.status, "streaming"),
        lt(messages.updatedAt, new Date(Date.now() - STALE_STREAM_MS)),
      ),
    );
}
