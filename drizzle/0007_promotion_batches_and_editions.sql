-- Persistence schema for the @ab/sources registry: promotion_batches + editions.
-- WP: docs/work-packages/promotion-batches-persistence/ (Phase 1 of 3).
-- Source of truth: ADR 019 §2.4 (audit row) and §6.1 (Edition).
--
-- This migration only creates the new sources_registry schema and its two
-- tables. The read path and write path land in Phase 2 and Phase 3
-- respectively (separate PRs).
--
-- Forward-only. Rollback SQL is in the accompanying README.

CREATE SCHEMA IF NOT EXISTS "sources_registry";--> statement-breakpoint
CREATE TABLE "sources_registry"."promotion_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"corpus" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"promotion_date" timestamp with time zone NOT NULL,
	"scope" jsonb NOT NULL,
	"input_source" text NOT NULL,
	"state" text NOT NULL,
	"from_lifecycle" text NOT NULL,
	"to_lifecycle" text NOT NULL,
	"previous_batch_id" text,
	CONSTRAINT "promotion_batches_state_check" CHECK ("state" IN ('promoted', 'de-promoted')),
	CONSTRAINT "promotion_batches_from_lifecycle_check" CHECK ("from_lifecycle" IN ('draft', 'pending', 'accepted', 'retired', 'superseded')),
	CONSTRAINT "promotion_batches_to_lifecycle_check" CHECK ("to_lifecycle" IN ('draft', 'pending', 'accepted', 'retired', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "sources_registry"."editions" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"edition_label" text NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "sources_registry"."promotion_batches" ADD CONSTRAINT "promotion_batches_previous_batch_fk" FOREIGN KEY ("previous_batch_id") REFERENCES "sources_registry"."promotion_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_batches_corpus_date_idx" ON "sources_registry"."promotion_batches" USING btree ("corpus","promotion_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "promotion_batches_previous_batch_idx" ON "sources_registry"."promotion_batches" USING btree ("previous_batch_id");--> statement-breakpoint
CREATE INDEX "promotion_batches_reviewer_date_idx" ON "sources_registry"."promotion_batches" USING btree ("reviewer_id","promotion_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "editions_source_date_idx" ON "sources_registry"."editions" USING btree ("source_id","published_at");--> statement-breakpoint
CREATE INDEX "editions_source_current_idx" ON "sources_registry"."editions" USING btree ("source_id") WHERE retired_at IS NULL;
