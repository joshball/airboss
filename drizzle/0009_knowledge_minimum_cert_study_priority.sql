-- Replace knowledge_node.relevance jsonb array with two scalar columns:
--   minimum_cert    -- the lowest cert that requires the topic
--   study_priority  -- critical / standard / stretch (study-time bucket)
--
-- The relevance array stored [{cert, bloom, priority}, ...]. We collapse it
-- to a single floor-cert (lowest cert in the array, by the project's cert
-- hierarchy) and a single priority (the highest-urgency value across the
-- entries). Nodes with no relevance entries get NULLs and are backfilled by
-- the next `bun run db build` from authored YAML.
--
-- Cert hierarchy: private < instrument < commercial < cfi for ordering
-- purposes only. (Instrument and commercial are siblings in the
-- prerequisite graph, but for picking a single floor we treat the lower
-- index as "lower" so a node tagged at both still has a well-defined
-- minimum_cert.)
--
-- Priority collapse:
--   any 'core'       -> critical
--   else any 'supporting' -> standard
--   else any 'elective'  -> stretch
--   else (no entries)    -> NULL

ALTER TABLE "study"."knowledge_node" ADD COLUMN "minimum_cert" text;
--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD COLUMN "study_priority" text;
--> statement-breakpoint

UPDATE "study"."knowledge_node"
SET "minimum_cert" = (
	SELECT cert
	FROM (
		SELECT (entry->>'cert')::text AS cert,
		       CASE (entry->>'cert')::text
		         WHEN 'private'     THEN 0
		         WHEN 'instrument'  THEN 1
		         WHEN 'commercial'  THEN 2
		         WHEN 'cfi'         THEN 3
		         ELSE 9
		       END AS rank
		FROM jsonb_array_elements("relevance") AS entry
	) ranked
	WHERE rank < 9
	ORDER BY rank ASC
	LIMIT 1
)
WHERE jsonb_typeof("relevance") = 'array' AND jsonb_array_length("relevance") > 0;
--> statement-breakpoint

UPDATE "study"."knowledge_node"
SET "study_priority" = CASE
	WHEN EXISTS (
		SELECT 1 FROM jsonb_array_elements("relevance") AS entry
		WHERE (entry->>'priority')::text = 'core'
	) THEN 'critical'
	WHEN EXISTS (
		SELECT 1 FROM jsonb_array_elements("relevance") AS entry
		WHERE (entry->>'priority')::text = 'supporting'
	) THEN 'standard'
	WHEN EXISTS (
		SELECT 1 FROM jsonb_array_elements("relevance") AS entry
		WHERE (entry->>'priority')::text = 'elective'
	) THEN 'stretch'
	ELSE NULL
END
WHERE jsonb_typeof("relevance") = 'array' AND jsonb_array_length("relevance") > 0;
--> statement-breakpoint

ALTER TABLE "study"."knowledge_node" ADD CONSTRAINT "knowledge_node_minimum_cert_check"
	CHECK ("minimum_cert" IS NULL OR "minimum_cert" IN ('private', 'instrument', 'commercial', 'cfi'));
--> statement-breakpoint
ALTER TABLE "study"."knowledge_node" ADD CONSTRAINT "knowledge_node_study_priority_check"
	CHECK ("study_priority" IS NULL OR "study_priority" IN ('critical', 'standard', 'stretch'));
--> statement-breakpoint

CREATE INDEX "knowledge_node_minimum_cert_idx" ON "study"."knowledge_node" ("minimum_cert");
--> statement-breakpoint
CREATE INDEX "knowledge_node_study_priority_idx" ON "study"."knowledge_node" ("study_priority");
--> statement-breakpoint

ALTER TABLE "study"."knowledge_node" DROP COLUMN "relevance";
