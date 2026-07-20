-- Backfill the new `version` column for any briefs that already exist. We
-- number them per-thread in created-at order so v1 is the oldest brief in
-- the thread, v2 the next, etc.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'briefs'
      AND column_name = 'version'
  ) AND EXISTS (SELECT 1 FROM briefs) THEN
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY thread_id
          ORDER BY created_at ASC, id ASC
        ) AS new_version
      FROM briefs
    )
    UPDATE briefs
    SET version = ranked.new_version
    FROM ranked
    WHERE briefs.id = ranked.id;
  END IF;
END
$$;--> statement-breakpoint

ALTER TABLE "briefs" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "briefs_thread_version_uidx" ON "briefs" USING btree ("thread_id","version");
