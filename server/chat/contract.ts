import { z } from "zod";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/server/storage/types";

export const chatRequestSchema = z
  .object({
    threadId: z.uuid(),
    requestId: z.uuid(),
    content: z.string().trim().max(20_000),
    attachmentIds: z.array(z.uuid()).max(MAX_ATTACHMENTS_PER_MESSAGE).default([]),
  })
  .refine((value) => value.content.length > 0 || value.attachmentIds.length > 0, {
    message: "A message or attachment is required",
  });

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
