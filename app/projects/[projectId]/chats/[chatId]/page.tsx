import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { ChatShell } from "@/components/chat/ChatShell";
import { getServerCaller } from "@/server/trpc/server";

type Props = {
  params: Promise<{ projectId: string; chatId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chatId } = await params;
  if (chatId === "new") return { title: "New thread — Stitch Talk" };
  try {
    const caller = await getServerCaller();
    const thread = await caller.threads.byId({ threadId: chatId });
    return {
      title: `${thread.title} · ${thread.projectName} — Stitch Talk`,
    };
  } catch {
    return { title: "Thread — Stitch Talk" };
  }
}

/** Full persisted chat experience inside a project. */
export default async function ChatPage({ params }: Props) {
  const { projectId, chatId } = await params;
  if (chatId === "new") redirect(`/projects/${projectId}`);

  const caller = await getServerCaller();
  let thread;
  try {
    thread = await caller.threads.byId({ threadId: chatId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  if (thread.projectId !== projectId) notFound();

  return (
    <ChatShell
      threadId={thread.id}
      projectId={thread.projectId}
      projectName={thread.projectName}
      chatTitle={thread.title}
      backHref={`/projects/${thread.projectId}`}
      initialMessages={thread.messages}
    />
  );
}
