import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const projectAccent = pgEnum("project_accent", [
  "thread",
  "teal",
  "ink",
  "sand",
]);
export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const messageStatus = pgEnum("message_status", [
  "complete",
  "streaming",
  "failed",
  "cancelled",
]);
export const attachmentStatus = pgEnum("attachment_status", [
  "pending",
  "ready",
  "attached",
  "orphaned",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    blurb: varchar("blurb", { length: 280 }).default("").notNull(),
    accent: projectAccent("accent").default("thread").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("projects_owner_updated_idx").on(
      table.ownerId,
      table.updatedAt.desc(),
    ),
  ],
);

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).default("New thread").notNull(),
    nextOrdinal: integer("next_ordinal").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("threads_project_updated_idx").on(
      table.projectId,
      table.updatedAt.desc(),
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    role: messageRole("role").notNull(),
    content: text("content").default("").notNull(),
    status: messageStatus("status").default("complete").notNull(),
    requestId: uuid("request_id").notNull(),
    errorCode: text("error_code"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("messages_thread_ordinal_uidx").on(
      table.threadId,
      table.ordinal,
    ),
    uniqueIndex("messages_request_role_uidx").on(
      table.threadId,
      table.requestId,
      table.role,
    ),
    uniqueIndex("messages_active_assistant_uidx")
      .on(table.threadId)
      .where(
        sql`${table.role} = 'assistant' and ${table.status} = 'streaming'`,
      ),
    index("messages_thread_ordinal_idx").on(table.threadId, table.ordinal),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    storageKey: text("storage_key").notNull().unique(),
    status: attachmentStatus("status").default("pending").notNull(),
    originalName: varchar("original_name", { length: 255 }),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksum: text("checksum"),
    position: smallint("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }),
  },
  (table) => [
    index("attachments_owner_status_created_idx").on(
      table.ownerId,
      table.status,
      table.createdAt,
    ),
    index("attachments_message_position_idx").on(
      table.messageId,
      table.position,
    ),
    uniqueIndex("attachments_message_position_uidx")
      .on(table.messageId, table.position)
      .where(sql`${table.messageId} is not null`),
  ],
);

export const briefs = pgTable(
  "briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    gaps: text("gaps").array().default(sql`'{}'::text[]`).notNull(),
    /**
     * Per-thread monotonic version number (1, 2, 3, …). Backfilled on
     * migration; new rows pick MAX(version)+1 within the thread in a single
     * INSERT race-free by way of `recordBriefFromChat` taking a row lock on
     * the thread.
     */
    version: integer("version").notNull().default(0),
    sourceThroughOrdinal: integer("source_through_ordinal").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("briefs_thread_created_idx").on(
      table.threadId,
      table.createdAt.desc(),
    ),
    /**
     * Two briefs within the same thread must never share a version. The UI
     * shows this number ("Brief · v2") so collisions are user-visible.
     */
    uniqueIndex("briefs_thread_version_uidx").on(
      table.threadId,
      table.version,
    ),
  ],
);

export const clerkWebhookEvents = pgTable("clerk_webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  attachments: many(attachments),
  briefs: many(briefs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  threads: many(threads),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  project: one(projects, {
    fields: [threads.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
  attachments: many(attachments),
  briefs: many(briefs),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  owner: one(users, {
    fields: [attachments.ownerId],
    references: [users.id],
  }),
  thread: one(threads, {
    fields: [attachments.threadId],
    references: [threads.id],
  }),
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
}));

export const briefsRelations = relations(briefs, ({ one }) => ({
  thread: one(threads, {
    fields: [briefs.threadId],
    references: [threads.id],
  }),
  creator: one(users, {
    fields: [briefs.createdBy],
    references: [users.id],
  }),
}));

export type ProjectAccent = (typeof projectAccent.enumValues)[number];
