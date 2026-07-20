import "server-only";

import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createThread,
  deleteThread,
  getThread,
  listThreads,
  renameThread,
} from "@/server/dal/threads";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

export const threadsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const threads = await listThreads(ctx.userId, input.projectId);
      if (!threads) throw new TRPCError({ code: "NOT_FOUND" });
      return threads;
    }),
  byId: protectedProcedure
    .input(z.object({ threadId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const thread = await getThread(ctx.userId, input.threadId);
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });
      return thread;
    }),
  create: protectedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await createThread(ctx.userId, input.projectId);
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });
      revalidatePath(`/projects/${input.projectId}`);
      return thread;
    }),
  rename: protectedProcedure
    .input(
      z.object({ threadId: z.uuid(), title: z.string().trim().min(1).max(160) }),
    )
    .mutation(async ({ ctx, input }) => {
      const thread = await renameThread(ctx.userId, input.threadId, input.title);
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });
      revalidatePath(`/projects/${thread.projectId}`);
      return thread;
    }),
  delete: protectedProcedure
    .input(z.object({ threadId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteThread(ctx.userId, input.threadId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),
});
