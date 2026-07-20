"use client";

import { useMutation } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";

export function NewThreadButton({
  projectId,
  variant = "primary",
}: {
  projectId: string;
  variant?: "primary" | "empty";
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const createThread = useMutation(trpc.threads.create.mutationOptions());

  const create = async () => {
    if (createThread.isPending) return;
    try {
      const thread = await createThread.mutateAsync({ projectId });
      router.push(`/projects/${projectId}/chats/${thread.id}`);
      router.refresh();
    } catch {
      // The mutation retains the error for future inline treatment.
    }
  };

  return (
    <button
      type="button"
      className="btn btn-thread"
      onClick={() => void create()}
      disabled={createThread.isPending}
    >
      <PlusIcon />
      {createThread.isPending
        ? "Opening…"
        : variant === "empty"
          ? "Start first thread"
          : "New thread"}
    </button>
  );
}
