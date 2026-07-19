import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { NewProjectButton } from "@/components/dashboard/NewProjectButton";
import { PROJECTS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Projects — Stitch Talk",
};

/**
 * Home of the product after auth: a simple list of projects.
 * One primary action — New project. Click a card to open threads.
 */
export default async function DashboardPage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in");

  const user = await currentUser();
  const firstName =
    user?.firstName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress.split("@")[0] ??
    "there";
  const projects = PROJECTS;

  return (
    <AppShell crumbs={[{ label: "Projects" }]}>
      <div className="page-wrap">
        <PageHeader
          eyebrow={`Hi, ${firstName}`}
          title="Projects"
          description="Each project is one product or brand. Open one to continue a thread, or start something new."
          actions={<NewProjectButton />}
        />

        {projects.length === 0 ? (
          <div className="empty-panel">
            <h2 className="empty-panel-title">No projects yet</h2>
            <p className="empty-panel-body">
              Create a project for the thing you&rsquo;re designing. Threads live
              inside it.
            </p>
            <NewProjectButton variant="empty" />
          </div>
        ) : (
          <ul className="project-grid">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`project-card project-card--${p.accent}`}
                >
                  <span className="project-swatch" aria-hidden="true" />
                  <div className="project-card-body">
                    <div className="project-card-top">
                      <h2 className="project-name">{p.name}</h2>
                      <span className="project-meta">{p.updatedLabel}</span>
                    </div>
                    <p className="project-blurb">{p.blurb}</p>
                    <p className="project-stat">
                      {p.threadCount === 0
                        ? "No threads yet"
                        : p.threadCount === 1
                          ? "1 thread"
                          : `${p.threadCount} threads`}
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
