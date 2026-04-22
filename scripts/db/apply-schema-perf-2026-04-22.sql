-- One-shot DDL to prepare the DB for the 2026-04-22 schema + perf fix round.
-- Must run BEFORE `bun run db push` so drizzle-kit can see `pg_trgm` when it
-- tries to add the GIN trigram indexes on study.card (front, back). Every
-- statement is idempotent so re-running is safe.

-- pg_trgm: required by the gin_trgm_ops opclass the schema declares on
-- study.card. Ships with postgres as a contrib extension; the airboss-db
-- container already has it available.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- review_rating_check used `BETWEEN 1 AND 4`. Replace with `IN (1,2,3,4)` so
-- a psql user reading `\d study.review` sees the discrete ts-fsrs labels the
-- rating encodes (AGAIN/HARD/GOOD/EASY) rather than an opaque range.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'study.review'::regclass
		  AND conname = 'review_rating_check'
		  AND pg_get_constraintdef(oid) NOT LIKE '%IN (1, 2, 3, 4)%'
	) THEN
		ALTER TABLE study.review DROP CONSTRAINT review_rating_check;
		ALTER TABLE study.review
			ADD CONSTRAINT review_rating_check CHECK ("rating" IN (1, 2, 3, 4));
	END IF;
END $$;

-- knowledge_node_progress.user_id was declared without ON UPDATE CASCADE.
-- The schema now declares it with cascade; drop + recreate the constraint so
-- existing DBs match the Drizzle model without a destructive drizzle-push
-- rename prompt.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'study.knowledge_node_progress'::regclass
		  AND conname = 'knowledge_node_progress_user_id_bauth_user_id_fk'
		  AND confupdtype <> 'c'
	) THEN
		ALTER TABLE study.knowledge_node_progress
			DROP CONSTRAINT knowledge_node_progress_user_id_bauth_user_id_fk;
		ALTER TABLE study.knowledge_node_progress
			ADD CONSTRAINT knowledge_node_progress_user_id_bauth_user_id_fk
			FOREIGN KEY (user_id) REFERENCES public.bauth_user(id)
			ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END $$;
