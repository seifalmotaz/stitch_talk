import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  generateBrief,
  getLatestBrief,
  listBriefsForThread,
} from "@/server/dal/briefs";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

export const briefsRouter = createTRPCRouter({
  latest: protectedProcedure
    .input(z.object({ threadId: z.uuid() }))
    .query(({ ctx, input }) => getLatestBrief(ctx.userId, input.threadId)),
  /**
   * Every brief saved in a thread. Backs the version list in the
   * right-side drawer.
   */
  list: protectedProcedure
    .input(z.object({ threadId: z.uuid() }))
    .query(({ ctx, input }) =>
      listBriefsForThread(ctx.userId, input.threadId),
    ),
  generate: protectedProcedure
    .input(z.object({ threadId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const brief = await generateBrief(ctx.userId, input.threadId).catch(
        (error: unknown) => {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error ? error.message : "Could not generate brief",
          });
        },
      );
      if (!brief) throw new TRPCError({ code: "NOT_FOUND" });
      return brief;
    }),
});
