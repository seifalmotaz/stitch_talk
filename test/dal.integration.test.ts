import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { messages, users } from "@/db/schema";
import {
  finishAssistant,
  loadModelTranscript,
  startTurn,
} from "@/server/dal/messages";
import { createProject, getProject, listProjects } from "@/server/dal/projects";
import { createThread, getThread, listThreads } from "@/server/dal/threads";
import { appRouter } from "@/server/trpc/routers/_app";
import { ensureAppUser } from "@/server/dal/users";

const userA = `user_test_a_${crypto.randomUUID()}`;
const userB = `user_test_b_${crypto.randomUUID()}`;

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userA));
  await db.delete(users).where(eq(users.id, userB));
  await pool.end();
});

describe("owned data access", () => {
  it("isolates projects, threads, and persisted turns by Clerk user", async () => {
    await ensureAppUser(userA);
    await ensureAppUser(userB);

    const project = await createProject(userA, { name: "Private project" });
    expect(await getProject(userB, project.id)).toBeNull();
    expect(await listProjects(userA)).toHaveLength(1);
    expect(await listProjects(userB)).toHaveLength(0);

    const thread = await createThread(userA, project.id);
    expect(thread).not.toBeNull();
    expect(await listThreads(userB, project.id)).toBeNull();
    if (!thread) throw new Error("Thread was not created");

    const requestId = crypto.randomUUID();
    const turn = await startTurn(userA, {
      threadId: thread.id,
      requestId,
      content: "Make it feel calm and editorial",
      attachmentIds: [],
    });
    expect(turn?.created).toBe(true);
    if (!turn) throw new Error("Turn was not created");

    const duplicate = await startTurn(userA, {
      threadId: thread.id,
      requestId,
      content: "Make it feel calm and editorial",
      attachmentIds: [],
    });
    expect(duplicate?.created).toBe(false);

    await finishAssistant(userA, turn.assistantMessageId, {
      content: "Use warm paper and quiet typography.",
      status: "complete",
    });
    const transcript = await loadModelTranscript(userA, thread.id);
    expect(transcript).toEqual([
      { role: "user", content: "Make it feel calm and editorial", images: undefined },
      { role: "assistant", content: "Use warm paper and quiet typography.", images: undefined },
    ]);
    expect(await getThread(userB, thread.id)).toBeNull();
    expect((await getThread(userA, thread.id))?.messages).toHaveLength(2);
  });

  it("enforces authentication in the typed API caller", async () => {
    const anonymous = appRouter.createCaller({ db, userId: null });
    await expect(anonymous.projects.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await ensureAppUser(userA);
    const authenticated = appRouter.createCaller({ db, userId: userA });
    await expect(authenticated.projects.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Private project" }),
      ]),
    );
  });

  it("reconciles stale streaming assistants on thread reads", async () => {
    await ensureAppUser(userA);
    const project = await createProject(userA, { name: "Stale stream project" });
    const thread = await createThread(userA, project.id);
    if (!thread) throw new Error("Thread was not created");
    const turn = await startTurn(userA, {
      threadId: thread.id,
      requestId: crypto.randomUUID(),
      content: "Start a response",
      attachmentIds: [],
    });
    if (!turn) throw new Error("Turn was not created");

    await db
      .update(messages)
      .set({ updatedAt: new Date(Date.now() - 3 * 60 * 1000) })
      .where(eq(messages.id, turn.assistantMessageId));

    const loaded = await getThread(userA, thread.id);
    expect(loaded?.messages.at(-1)?.status).toBe("cancelled");
  });

  it("does not resurrect a soft-deleted Clerk user", async () => {
    await ensureAppUser(userB);
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, userB));
    await expect(ensureAppUser(userB)).resolves.toBe(false);
  });
});
