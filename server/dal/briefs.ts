import "server-only";

import { and, desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { briefs, messages, projects, threads } from "@/db/schema";
import { loadModelTranscript } from "@/server/dal/messages";
import { generateCompletion } from "@/lib/openrouter";
import { BRIEF_SYSTEM_PROMPT } from "@/lib/prompts";

/**
 * Brief DTO returned to clients. Version is part of the public contract —
 * callers display it as "Brief · v2". `createdAt` is string-ified for safe
 * crossing of the server/client boundary.
 */
export type BriefDto = {
  id: string;
  threadId: string;
  prompt: string;
  gaps: string[];
  version: number;
  createdAt: string;
};

/**
 * Run the brief-generation model against the current transcript and persist
 * a new versioned row. Called when the chat model invokes the
 * `save_brief_version` tool, and (legacy) by the tRPC `generate` mutation.
 *
 * Concurrency: takes a row lock on the thread before computing the next
 * `version`, so two concurrent saves on the same thread cannot produce
 * duplicate version numbers — a unique index on `(thread_id, version)`
 * backstops this with a hard error if a race ever slips through.
 */
export async function recordBriefFromChat(
  userId: string,
  threadId: string,
): Promise<BriefDto | null> {
  const transcript = await loadModelTranscript(userId, threadId);
  if (!transcript) return null;
  const userTurns = transcript.filter((message) => message.role === "user");
  if (userTurns.length < 2) throw new Error("Have a few exchanges first");

  const textTranscript = transcript.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const raw = await generateCompletion(textTranscript, BRIEF_SYSTEM_PROMPT, {
    responseFormat: { type: "json_object" },
  });
  const parsed = parseBriefPayload(raw);
  if (!parsed) throw new Error("The model returned an invalid brief");

  return await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ threadId: threads.id })
      .from(threads)
      .innerJoin(projects, eq(threads.projectId, projects.id))
      .where(and(eq(threads.id, threadId), eq(projects.ownerId, userId)))
      .for("update")
      .limit(1);
    if (!owned) throw new Error("Thread not found");

    const [source] = await tx
      .select({ ordinal: max(messages.ordinal) })
      .from(messages)
      .where(eq(messages.threadId, threadId));

    const [{ max: latest }] = await tx
      .select({
        max: sql<number>`coalesce(max(${briefs.version}), 0)`,
      })
      .from(briefs)
      .where(eq(briefs.threadId, threadId));

    const [brief] = await tx
      .insert(briefs)
      .values({
        threadId,
        createdBy: userId,
        prompt: parsed.prompt,
        gaps: parsed.gaps,
        version: latest + 1,
        sourceThroughOrdinal: source?.ordinal ?? 0,
        model: process.env.OPENROUTER_MODEL,
      })
      .returning();
    return toBriefDto(brief);
  });
}

/**
 * Legacy "generate brief" path — used by the tRPC `briefs.generate` mutation
 * for clients that haven't adopted the in-chat tool call flow yet. Internally
 * it just calls `recordBriefFromChat` and returns the same DTO.
 */
export async function generateBrief(userId: string, threadId: string) {
  return recordBriefFromChat(userId, threadId);
}

/**
 * Fetch the most recent brief in a thread, if any. Kept for the project /
 * thread page that wants to surface a "latest brief" link.
 */
export async function getLatestBrief(userId: string, threadId: string) {
  const [brief] = await db
    .select()
    .from(briefs)
    .where(and(eq(briefs.threadId, threadId), eq(briefs.createdBy, userId)))
    .orderBy(desc(briefs.createdAt))
    .limit(1);
  return brief ? toBriefDto(brief) : null;
}

/**
 * Every brief saved in this thread, newest first. Used by the side drawer
 * to render the version list ("v3 • Mar 14", "v2 • Mar 12", …).
 */
export async function listBriefsForThread(
  userId: string,
  threadId: string,
): Promise<BriefDto[]> {
  const rows = await db
    .select({
      brief: briefs,
      ownerId: projects.ownerId,
    })
    .from(briefs)
    .innerJoin(threads, eq(briefs.threadId, threads.id))
    .innerJoin(projects, eq(threads.projectId, projects.id))
    .where(and(eq(briefs.threadId, threadId), eq(projects.ownerId, userId)))
    .orderBy(desc(briefs.version));
  return rows.map((row) => toBriefDto(row.brief));
}

/**
 * Parse the brief JSON payload the model returns. Strips ```json code-fence
 * markers some providers add. Trims gaps to 500 chars and caps the count at
 * 12 to keep the UI sane.
 */
export function parseBriefPayload(raw: string) {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { prompt?: unknown; gaps?: unknown };
    if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) return null;
    return {
      prompt: parsed.prompt.trim(),
      gaps: Array.isArray(parsed.gaps)
        ? parsed.gaps
            .filter((gap): gap is string => typeof gap === "string")
            .map((gap) => gap.trim().slice(0, 500))
            .filter(Boolean)
            .slice(0, 12)
        : [],
    };
  } catch {
    return null;
  }
}

function toBriefDto(brief: typeof briefs.$inferSelect): BriefDto {
  return {
    id: brief.id,
    threadId: brief.threadId,
    prompt: brief.prompt,
    gaps: brief.gaps,
    version: brief.version,
    createdAt: brief.createdAt.toISOString(),
  };
}
