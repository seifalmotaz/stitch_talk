import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquareIcon } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { NewThreadButton } from "@/components/project/NewThreadButton";
import { getProject, getThreadsForProject } from "@/lib/mock-data";

type Props = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const project = getProject(projectId);
  return {
    title: project ? `${project.name} — Stitch Talk` : "Project — Stitch Talk",
  };
}

/**
 * Project hub: list of design threads for one product.
 * Primary action is always "New thread".
 */
export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const threads = getThreadsForProject(projectId);

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

        {threads.length === 0 ? (
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
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/projects/${projectId}/chats/${t.id}`}
                  className="thread-row"
                >
                  <span className="thread-knot" aria-hidden="true" />
                  <div className="thread-body">
                    <div className="thread-top">
                      <h2 className="thread-title">{t.title}</h2>
                      <time className="thread-time">{t.updatedLabel}</time>
                    </div>
                    <p className="thread-preview">{t.preview}</p>
                    <p className="thread-stat">
                      {t.messageCount} messages
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
