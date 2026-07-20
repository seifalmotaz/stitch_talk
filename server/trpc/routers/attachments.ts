import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  completeAttachment,
  prepareAttachment,
} from "@/server/dal/attachments";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/types/uploads";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

export const attachmentsRouter = createTRPCRouter({
  createUpload: protectedProcedure
    .input(
      z.object({
        threadId: z.uuid(),
        originalName: z.string().max(255).optional(),
        mimeType: z.enum(ALLOWED_IMAGE_TYPES),
        byteSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const upload = await prepareAttachment(ctx.userId, input);
      if (!upload) throw new TRPCError({ code: "NOT_FOUND" });
      return upload;
    }),
  completeUpload: protectedProcedure
    .input(z.object({ attachmentId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await completeAttachment(
        ctx.userId,
        input.attachmentId,
      );
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });
      return attachment;
    }),
  limits: protectedProcedure.query(() => ({
    maxBytes: MAX_ATTACHMENT_BYTES,
    maxPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
  })),
});
