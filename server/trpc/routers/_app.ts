import "server-only";

import { attachmentsRouter } from "@/server/trpc/routers/attachments";
import { briefsRouter } from "@/server/trpc/routers/briefs";
import { messagesRouter } from "@/server/trpc/routers/messages";
import { projectsRouter } from "@/server/trpc/routers/projects";
import { threadsRouter } from "@/server/trpc/routers/threads";
import { createTRPCRouter } from "@/server/trpc/init";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  threads: threadsRouter,
  messages: messagesRouter,
  briefs: briefsRouter,
  attachments: attachmentsRouter,
});

export type AppRouter = typeof appRouter;
