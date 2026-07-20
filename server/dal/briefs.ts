import "server-only";

import { and, desc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { briefs, messages } from "@/db/schema";
import { loadModelTranscript } from "@/server/dal/messages";
import { findOwnedThread } from "@/server/dal/ownership";
import { generateCompletion } from "@/lib/openrouter";
import { BRIEF_SYSTEM_PROMPT } from "@/lib/prompts";

export async function generateBrief(userId: string, threadId: string) {
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

  const [source] = await db
    .select({ ordinal: max(messages.ordinal) })
    .from(messages)
    .where(eq(messages.threadId, threadId));
  const [brief] = await db
    .insert(briefs)
    .values({
      threadId,
      createdBy: userId,
      prompt: parsed.prompt,
      gaps: parsed.gaps,
      sourceThroughOrdinal: source?.ordinal ?? 0,
      model: process.env.OPENROUTER_MODEL,
    })
    .returning();
  return toBriefDto(brief);
}

export async function getLatestBrief(userId: string, threadId: string) {
  const owned = await findOwnedThread(userId, threadId);
  if (!owned) return null;
  const [brief] = await db
    .select()
    .from(briefs)
    .where(and(eq(briefs.threadId, threadId), eq(briefs.createdBy, userId)))
    .orderBy(desc(briefs.createdAt))
    .limit(1);
  return brief ? toBriefDto(brief) : null;
}

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

function toBriefDto(brief: typeof briefs.$inferSelect) {
  return {
    id: brief.id,
    prompt: brief.prompt,
    gaps: brief.gaps,
    createdAt: brief.createdAt.toISOString(),
  };
}
