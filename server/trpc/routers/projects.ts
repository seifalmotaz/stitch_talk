import "server-only";

import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { projectAccent } from "@/db/schema";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "@/server/dal/projects";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

const accent = z.enum(projectAccent.enumValues);

export const projectsRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => listProjects(ctx.userId)),
  byId: protectedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(ctx.userId, input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      return project;
    }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        blurb: z.string().trim().max(280).optional(),
        accent: accent.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await createProject(ctx.userId, input);
      revalidatePath("/dashboard");
      return project;
    }),
  update: protectedProcedure
    .input(
      z.object({
        projectId: z.uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        blurb: z.string().trim().max(280).optional(),
        accent: accent.optional(),
      }),
    )
    .mutation(async ({ ctx, input: { projectId, ...input } }) => {
      const project = await updateProject(ctx.userId, projectId, input);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      revalidatePath("/dashboard");
      revalidatePath(`/projects/${projectId}`);
      return project;
    }),
  delete: protectedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteProject(ctx.userId, input.projectId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      revalidatePath("/dashboard");
      return { deleted: true };
    }),
});
