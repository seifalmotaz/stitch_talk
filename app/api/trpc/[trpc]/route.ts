import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            if (error.code === "INTERNAL_SERVER_ERROR") {
              console.error(`tRPC failed on ${path ?? "unknown"}:`, error);
            }
          }
        : undefined,
  });
}

export { handler as GET, handler as POST };
