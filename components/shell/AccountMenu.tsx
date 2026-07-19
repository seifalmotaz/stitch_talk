"use client";

import { UserButton } from "@clerk/nextjs";

/** Clerk-backed account control, themed globally to match the studio bar. */
export function AccountMenu() {
  return <UserButton showName />;
}
