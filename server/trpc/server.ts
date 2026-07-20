import "server-only";

import { cache } from "react";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/context";

export const getServerCaller = cache(async () =>
  appRouter.createCaller(await createTRPCContext()),
);
