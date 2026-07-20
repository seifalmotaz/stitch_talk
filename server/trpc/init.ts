import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import type { TRPCContext } from "@/server/trpc/context";
import { ensureAppUser } from "@/server/dal/users";

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message:
        error.code === "INTERNAL_SERVER_ERROR"
          ? "Something went wrong on the server"
          : shape.message,
    };
  },
});

export const createTRPCRouter = t.router;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const active = await ensureAppUser(ctx.userId);
  if (!active) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
