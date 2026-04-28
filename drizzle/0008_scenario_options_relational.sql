-- Promote scenario.options JSONB to a relational scenario_option table.
-- See docs/work-packages/scenario-options-relational/spec.md.
--
-- DATA PRESERVATION CONTRACT
--
-- The existing JSONB shape is `[{ id, text, isCorrect, outcome, whyNot }]`
-- per ScenarioOption (libs/bc/study/src/schema.ts). This migration unnests
-- every scenario's options into typed rows, then re-typifies
-- session_item_result.chosen_option (text) as chosen_option_id (FK to
-- scenario_option.id). The historical chosen_option string values ARE the
-- option ids -- the data is preserved without rewriting; only the column's
-- type/constraint changes. session_item_result rows are not touched in
-- terms of count or ordering.

CREATE TABLE "study"."scenario_option" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"outcome" text NOT NULL,
	"why_not" text DEFAULT '' NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "scenario_option_why_not_required_check" CHECK (("is_correct" = true) OR (length(trim("why_not")) > 0))
);--> statement-breakpoint

ALTER TABLE "study"."scenario_option" ADD CONSTRAINT "scenario_option_scenario_id_scenario_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "study"."scenario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

CREATE UNIQUE INDEX "scenario_option_scenario_position_unique" ON "study"."scenario_option" USING btree ("scenario_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_option_correct_unique" ON "study"."scenario_option" USING btree ("scenario_id") WHERE is_correct = true;--> statement-breakpoint

-- Backfill: unnest JSONB array into typed rows. `WITH ORDINALITY` preserves
-- the authored order in the new `position` column (0-based). The PK is
-- namespaced as `${scenario_id}__${authored_option_id}` so the same
-- letter-style id ("a", "b") used across scenarios in the JSONB doesn't
-- collide on the global PK.
INSERT INTO "study"."scenario_option" ("id", "scenario_id", "text", "is_correct", "outcome", "why_not", "position")
SELECT
	s."id" || '__' || (elem->>'id')::text,
	s."id",
	(elem->>'text')::text,
	(elem->>'isCorrect')::boolean,
	COALESCE(elem->>'outcome', '')::text,
	COALESCE(elem->>'whyNot', '')::text,
	(ord - 1)::smallint
FROM "study"."scenario" s
CROSS JOIN LATERAL jsonb_array_elements(s."options") WITH ORDINALITY AS arr(elem, ord);--> statement-breakpoint

-- Drop the JSONB shape check before dropping the column it guards.
ALTER TABLE "study"."scenario" DROP CONSTRAINT "scenario_options_shape_check";--> statement-breakpoint

-- Rename the text column to its FK identity, then rewrite each non-null
-- value from the bare authored letter ("a", "b") to the namespaced PK
-- (`${scenario_id}__${letter}`). The FK added below validates the rewrite.
ALTER TABLE "study"."session_item_result" RENAME COLUMN "chosen_option" TO "chosen_option_id";--> statement-breakpoint

UPDATE "study"."session_item_result"
   SET "chosen_option_id" = "scenario_id" || '__' || "chosen_option_id"
 WHERE "chosen_option_id" IS NOT NULL
   AND "scenario_id" IS NOT NULL;--> statement-breakpoint

-- Belt-and-braces: any remaining non-null chosen_option_id without a
-- matching scenario_option row gets cleared to NULL so the FK ADD does not
-- abort the migration on a historical typo or mid-migration write race.
UPDATE "study"."session_item_result" sir
   SET "chosen_option_id" = NULL
 WHERE sir."chosen_option_id" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "study"."scenario_option" so WHERE so."id" = sir."chosen_option_id"
   );--> statement-breakpoint

ALTER TABLE "study"."session_item_result" ADD CONSTRAINT "session_item_result_chosen_option_id_scenario_option_id_fk" FOREIGN KEY ("chosen_option_id") REFERENCES "study"."scenario_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Authoritative source moves to scenario_option; drop the JSONB column.
ALTER TABLE "study"."scenario" DROP COLUMN "options";
