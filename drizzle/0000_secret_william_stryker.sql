CREATE TYPE "public"."attachment_status" AS ENUM('pending', 'ready', 'attached', 'orphaned');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('complete', 'streaming', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."project_accent" AS ENUM('thread', 'teal', 'ink', 'sand');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"thread_id" uuid,
	"message_id" uuid,
	"storage_key" text NOT NULL,
	"status" "attachment_status" DEFAULT 'pending' NOT NULL,
	"original_name" varchar(255),
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum" text,
	"position" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attached_at" timestamp with time zone,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"prompt" text NOT NULL,
	"gaps" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_through_ordinal" integer NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clerk_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" "message_status" DEFAULT 'complete' NOT NULL,
	"request_id" uuid NOT NULL,
	"error_code" text,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"blurb" varchar(280) DEFAULT '' NOT NULL,
	"accent" "project_accent" DEFAULT 'thread' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(160) DEFAULT 'New thread' NOT NULL,
	"next_ordinal" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_owner_status_created_idx" ON "attachments" USING btree ("owner_id","status","created_at");--> statement-breakpoint
CREATE INDEX "attachments_message_position_idx" ON "attachments" USING btree ("message_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_message_position_uidx" ON "attachments" USING btree ("message_id","position") WHERE "attachments"."message_id" is not null;--> statement-breakpoint
CREATE INDEX "briefs_thread_created_idx" ON "briefs" USING btree ("thread_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "messages_thread_ordinal_uidx" ON "messages" USING btree ("thread_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_request_role_uidx" ON "messages" USING btree ("thread_id","request_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_active_assistant_uidx" ON "messages" USING btree ("thread_id") WHERE "messages"."role" = 'assistant' and "messages"."status" = 'streaming';--> statement-breakpoint
CREATE INDEX "messages_thread_ordinal_idx" ON "messages" USING btree ("thread_id","ordinal");--> statement-breakpoint
CREATE INDEX "projects_owner_updated_idx" ON "projects" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "threads_project_updated_idx" ON "threads" USING btree ("project_id","updated_at" DESC NULLS LAST);