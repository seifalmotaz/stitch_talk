import "server-only";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";

export async function createTRPCContext() {
  const { userId } = await auth();
  return { db, userId };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
