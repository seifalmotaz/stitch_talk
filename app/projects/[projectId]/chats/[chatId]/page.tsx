import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatShell } from "@/components/chat/ChatShell";
import { getProject, getThread } from "@/lib/mock-data";

type Props = {
  params: Promise<{ projectId: string; chatId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId, chatId } = await params;
  const project = getProject(projectId);
  if (!project) return { title: "Chat — Stitch Talk" };
  if (chatId === "new") {
    return { title: `New thread · ${project.name} — Stitch Talk` };
  }
  const thread = getThread(projectId, chatId);
  return {
    title: thread
      ? `${thread.title} · ${project.name} — Stitch Talk`
      : `Thread · ${project.name} — Stitch Talk`,
  };
}

/**
 * Full chat experience inside a project.
 * chatId = "new" starts a blank thread; otherwise mock title from data.
 */
export default async function ChatPage({ params }: Props) {
  const { projectId, chatId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const isNew = chatId === "new";
  const thread = isNew ? undefined : getThread(projectId, chatId);

  // Unknown thread ids still open a usable chat (mock-friendly).
  const chatTitle = isNew
    ? "New thread"
    : thread?.title ?? "Design thread";

  return (
    <ChatShell
      projectId={projectId}
      projectName={project.name}
      chatTitle={chatTitle}
      backHref={`/projects/${projectId}`}
    />
  );
}
