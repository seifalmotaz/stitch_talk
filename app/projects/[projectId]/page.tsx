import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { MessageSquareIcon } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { NewThreadButton } from "@/components/project/NewThreadButton";
import { getServerCaller } from "@/server/trpc/server";

type Props = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  try {
    const caller = await getServerCaller();
    const project = await caller.projects.byId({ projectId });
    return { title: `${project.name} — Stitch Talk` };
  } catch {
    return { title: "Project — Stitch Talk" };
  }
}

/** Project hub: list of design threads for one product. */
export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const caller = await getServerCaller();

  let project;
  let projectThreads;
  try {
    [project, projectThreads] = await Promise.all([
      caller.projects.byId({ projectId }),
      caller.threads.list({ projectId }),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <AppShell
      crumbs={[
        { label: "Projects", href: "/dashboard" },
        { label: project.name },
      ]}
    >
      <div className="page-wrap">
        <PageHeader
          title={project.name}
          description={project.blurb}
          actions={<NewThreadButton projectId={projectId} />}
        />

        {projectThreads.length === 0 ? (
          <div className="empty-panel">
            <div className="empty-panel-icon" aria-hidden="true">
              <MessageSquareIcon />
            </div>
            <h2 className="empty-panel-title">No threads yet</h2>
            <p className="empty-panel-body">
              A thread is one design conversation — direction, tone, references,
              then a brief. Start with a blank one.
            </p>
            <NewThreadButton projectId={projectId} variant="empty" />
          </div>
        ) : (
          <ul className="thread-list">
            {projectThreads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/projects/${projectId}/chats/${thread.id}`}
                  className="thread-row"
                >
                  <span className="thread-knot" aria-hidden="true" />
                  <div className="thread-body">
                    <div className="thread-top">
                      <h2 className="thread-title">{thread.title}</h2>
                      <time className="thread-time">{thread.updatedLabel}</time>
                    </div>
                    <p className="thread-preview">{thread.preview}</p>
                    <p className="thread-stat">
                      {thread.messageCount === 1
                        ? "1 message"
                        : `${thread.messageCount} messages`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
