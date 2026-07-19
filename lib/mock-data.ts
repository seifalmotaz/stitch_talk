/**
 * Static mock data for the UI shell.
 * No backend — enough structure to walk the real product path:
 * Dashboard → Project → Thread (chat).
 */

export type Project = {
  id: string;
  name: string;
  /** One-line intent, shown under the name. */
  blurb: string;
  updatedAt: string;
  /** ISO date for sorting/display helpers. */
  updatedLabel: string;
  threadCount: number;
  /** Optional accent for the project swatch. */
  accent: "thread" | "teal" | "ink" | "sand";
};

export type Thread = {
  id: string;
  projectId: string;
  title: string;
  preview: string;
  updatedLabel: string;
  messageCount: number;
};

export const PROJECTS: Project[] = [
  {
    id: "aurora",
    name: "Aurora Health",
    blurb: "Calm clinical app for first-time patients",
    updatedAt: "2026-07-18T14:20:00Z",
    updatedLabel: "Yesterday",
    threadCount: 3,
    accent: "teal",
  },
  {
    id: "folio",
    name: "Personal portfolio",
    blurb: "Make it feel like me — not a template",
    updatedAt: "2026-07-17T09:10:00Z",
    updatedLabel: "2 days ago",
    threadCount: 2,
    accent: "thread",
  },
  {
    id: "ledger",
    name: "Ledger refresh",
    blurb: "Keep the trust, rewrite the surface",
    updatedAt: "2026-07-12T11:00:00Z",
    updatedLabel: "Last week",
    threadCount: 1,
    accent: "ink",
  },
  {
    id: "market",
    name: "Weekend market app",
    blurb: "Local vendors, bright and handheld",
    updatedAt: "2026-07-05T16:40:00Z",
    updatedLabel: "2 weeks ago",
    threadCount: 0,
    accent: "sand",
  },
];

export const THREADS: Thread[] = [
  {
    id: "t1",
    projectId: "aurora",
    title: "Direction from first principles",
    preview:
      "Who is the primary patient, and how anxious are they on first open?",
    updatedLabel: "2 hours ago",
    messageCount: 12,
  },
  {
    id: "t2",
    projectId: "aurora",
    title: "Tone: clinical vs human",
    preview: "Soft teal, lots of air, never cold. Avoid pure white clinical.",
    updatedLabel: "Yesterday",
    messageCount: 8,
  },
  {
    id: "t3",
    projectId: "aurora",
    title: "Brief draft — v1",
    preview: "A calm, trustworthy health companion for first-time…",
    updatedLabel: "3 days ago",
    messageCount: 5,
  },
  {
    id: "t4",
    projectId: "folio",
    title: "Personality keywords",
    preview: "Sharp, warm, a little weird — like a good conversation.",
    updatedLabel: "2 days ago",
    messageCount: 9,
  },
  {
    id: "t5",
    projectId: "folio",
    title: "Reference audit",
    preview: "Love: Stripe docs energy. Hate: template portfolio grids.",
    updatedLabel: "4 days ago",
    messageCount: 6,
  },
  {
    id: "t6",
    projectId: "ledger",
    title: "What stays vs what goes",
    preview: "Keep the navy trust. Soften the corners. Kill the density.",
    updatedLabel: "Last week",
    messageCount: 14,
  },
];

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getThreadsForProject(projectId: string): Thread[] {
  return THREADS.filter((t) => t.projectId === projectId);
}

export function getThread(
  projectId: string,
  threadId: string
): Thread | undefined {
  return THREADS.find((t) => t.projectId === projectId && t.id === threadId);
}
