DROP INDEX "hangar"."hangar_reference_dirty_idx";--> statement-breakpoint
DROP INDEX "hangar"."hangar_source_dirty_idx";--> statement-breakpoint
ALTER TABLE "study"."knowledge_edge" ADD COLUMN "seed_origin" text;--> statement-breakpoint
CREATE INDEX "hangar_reference_live_idx" ON "hangar"."reference" USING btree ("id") WHERE "hangar"."reference"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_source_live_idx" ON "hangar"."source" USING btree ("id") WHERE "hangar"."source"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "hangar_reference_dirty_idx" ON "hangar"."reference" USING btree ("dirty") WHERE "hangar"."reference"."dirty" = true;--> statement-breakpoint
CREATE INDEX "hangar_source_dirty_idx" ON "hangar"."source" USING btree ("dirty") WHERE "hangar"."source"."dirty" = true;--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_op_check" CHECK ("op" IN ('create', 'update', 'delete', 'action'));--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_target_type_check" CHECK ("target_type" IN ('hangar.ping', 'hangar.reference', 'hangar.source', 'hangar.sync', 'hangar.job', 'hangar.source.edition-resolved', 'hangar.source.edition-drift', 'hangar.source.thumbnail-generated'));--> statement-breakpoint
ALTER TABLE "hangar"."job" ADD CONSTRAINT "hangar_job_status_check" CHECK ("status" IN ('queued', 'running', 'complete', 'failed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "hangar"."job" ADD CONSTRAINT "hangar_job_kind_check" CHECK ("kind" IN ('sync-to-disk', 'fetch-source', 'upload-source', 'extract-source', 'build-references', 'diff-source', 'validate-references', 'size-report'));--> statement-breakpoint
ALTER TABLE "hangar"."job_log" ADD CONSTRAINT "hangar_job_log_stream_check" CHECK ("stream" IN ('stdout', 'stderr', 'event'));--> statement-breakpoint
ALTER TABLE "hangar"."source" ADD CONSTRAINT "hangar_source_type_check" CHECK ("type" IN ('cfr', 'aim', 'pcg', 'ac', 'acs', 'phak', 'afh', 'ifh', 'poh', 'ntsb', 'gajsc', 'aopa', 'faa-safety', 'sop', 'authored', 'derived', 'sectional'));--> statement-breakpoint
ALTER TABLE "hangar"."sync_log" ADD CONSTRAINT "hangar_sync_log_kind_check" CHECK ("kind" IN ('commit-local', 'pr'));--> statement-breakpoint
ALTER TABLE "hangar"."sync_log" ADD CONSTRAINT "hangar_sync_log_outcome_check" CHECK ("outcome" IN ('success', 'noop', 'conflict', 'failed'));