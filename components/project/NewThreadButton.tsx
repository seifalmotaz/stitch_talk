"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";

export function NewThreadButton({
  projectId,
  variant = "primary",
}: {
  projectId: string;
  variant?: "primary" | "empty";
}) {
  return (
    <Link
      href={`/projects/${projectId}/chats/new`}
      className="btn btn-thread"
    >
      <PlusIcon />
      {variant === "empty" ? "Start first thread" : "New thread"}
    </Link>
  );
}
