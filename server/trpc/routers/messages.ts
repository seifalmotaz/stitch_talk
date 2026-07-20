import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cancelTurn } from "@/server/dal/messages";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

export const messagesRouter = createTRPCRouter({
  cancel: protectedProcedure
    .input(z.object({ threadId: z.uuid(), requestId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await cancelTurn(ctx.userId, input.threadId, input.requestId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),
});
