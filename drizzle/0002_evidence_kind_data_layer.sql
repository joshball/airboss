-- evidence-kind-data-layer WP -- closes the three not_applicable shims in
-- libs/bc/study/src/mastery.ts (WP B / PR #361). Schema is applied via
-- `drizzle-kit push` from the TS source of truth; this SQL ships for diff
-- accuracy and as a future revive-the-migrate-path artifact (see drizzle/README.md).
--
-- Drift note: 0001 left a handful of TS-only schema additions un-snapshotted
-- (card_feedback_user_card_created_idx, card_user_updated_idx, goal_user_updated_idx,
-- knowledge_edge_no_self_loop_check, sir_chosen_option_idx, audit_log_target_type_check
-- value-list bumps). Those are unrelated to this WP. They stay in the
-- TS schema and the meta snapshot so the next generate diff is clean; this
-- file documents only the changes this WP introduces.

CREATE TABLE "study"."teaching_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"domain" text NOT NULL,
	"node_id" text,
	"is_editable" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"seed_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teaching_exercise_status_check" CHECK ("status" IN ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "study"."teaching_exercise" ADD CONSTRAINT "teaching_exercise_user_id_bauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bauth_user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "study"."teaching_exercise" ADD CONSTRAINT "teaching_exercise_node_id_knowledge_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "study"."knowledge_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teaching_exercise_user_node_idx" ON "study"."teaching_exercise" USING btree ("user_id","node_id");--> statement-breakpoint

ALTER TABLE "study"."card" ADD COLUMN "kind" text DEFAULT 'recall' NOT NULL;--> statement-breakpoint
CREATE INDEX "card_user_kind_idx" ON "study"."card" USING btree ("user_id","kind");--> statement-breakpoint
ALTER TABLE "study"."card" ADD CONSTRAINT "card_kind_check" CHECK ("kind" IN ('recall', 'calculation'));--> statement-breakpoint

ALTER TABLE "study"."scenario" ADD COLUMN "assessment_methods" jsonb DEFAULT '["scenario"]'::jsonb NOT NULL;--> statement-breakpoint

ALTER TABLE "study"."session_item_result" ADD COLUMN "teaching_exercise_id" text;--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_teaching_exercise_id_teaching_exercise_id_fk" FOREIGN KEY ("teaching_exercise_id") REFERENCES "study"."teaching_exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sir_teaching_exercise_idx" ON "study"."session_item_result" USING btree ("teaching_exercise_id") WHERE "study"."session_item_result"."teaching_exercise_id" is not null;--> statement-breakpoint

ALTER TABLE "study"."session_item_result" DROP CONSTRAINT "sir_item_kind_check";--> statement-breakpoint
ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "sir_item_kind_check" CHECK ("item_kind" IN ('card', 'rep', 'node_start', 'teaching-exercise'));
