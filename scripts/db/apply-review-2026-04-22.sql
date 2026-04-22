-- One-shot DDL to apply schema changes from the 2026-04-22 review cycle.
-- `bun run db push` requires a TTY for drizzle-kit's rename prompts, so this
-- file applies the same DDL non-interactively. Every statement is idempotent
-- (IF NOT EXISTS / IF EXISTS / guarded with a pg_catalog check) so re-running
-- is safe.

-- ---- audit namespace + audit_log table -----------------------------------

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.audit_log (
	id text PRIMARY KEY,
	timestamp timestamp with time zone NOT NULL DEFAULT now(),
	actor_id text REFERENCES public.bauth_user(id) ON DELETE SET NULL ON UPDATE CASCADE,
	op text NOT NULL,
	target_type text NOT NULL,
	target_id text,
	"before" jsonb,
	"after" jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit.audit_log (actor_id, timestamp);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit.audit_log (target_type, target_id, timestamp);

-- ---- session_item_result: FK on user_id + UNIQUE(session_id, slot_index) --

-- Replace the non-unique sir_session_slot_idx with a UNIQUE index on the
-- same columns. The UNIQUE is what backs the atomic UPSERT in recordItemResult.
DROP INDEX IF EXISTS study.sir_session_slot_idx;
CREATE UNIQUE INDEX IF NOT EXISTS sir_session_slot_unique
	ON study.session_item_result (session_id, slot_index);

-- FK on user_id -> bauth_user(id). idempotent via pg_catalog check.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'study.session_item_result'::regclass
		  AND conname = 'session_item_result_user_id_bauth_user_id_fk'
	) THEN
		ALTER TABLE study.session_item_result
			ADD CONSTRAINT session_item_result_user_id_bauth_user_id_fk
			FOREIGN KEY (user_id) REFERENCES public.bauth_user(id)
			ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END $$;

-- ---- card_state.updated_at ------------------------------------------------

ALTER TABLE study.card_state
	ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- ---- card: reorder (user_id, node_id) index to (node_id, user_id) --------

DROP INDEX IF EXISTS study.card_user_node_idx;
CREATE INDEX IF NOT EXISTS card_node_user_idx ON study.card (node_id, user_id);

-- ---- plan active partial UNIQUE (already in plan-active-unique.sql) -------

CREATE UNIQUE INDEX IF NOT EXISTS plan_user_active_uniq
	ON study.study_plan (user_id)
	WHERE status = 'active';

-- ---- session: CHECKs for focus_override / cert_override / session_length -

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'study.session'::regclass AND conname = 'session_focus_override_check'
	) THEN
		ALTER TABLE study.session
			ADD CONSTRAINT session_focus_override_check
			CHECK (focus_override IS NULL OR focus_override IN (
				'regulations', 'weather', 'airspace', 'glass-cockpits', 'ifr-procedures',
				'vfr-operations', 'aerodynamics', 'teaching-methodology', 'adm-human-factors',
				'safety-accident-analysis', 'aircraft-systems', 'flight-planning',
				'emergency-procedures', 'faa-practical-standards'
			));
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'study.session'::regclass AND conname = 'session_cert_override_check'
	) THEN
		ALTER TABLE study.session
			ADD CONSTRAINT session_cert_override_check
			CHECK (cert_override IS NULL OR cert_override IN ('PPL', 'IR', 'CPL', 'CFI'));
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'study.session'::regclass AND conname = 'session_session_length_check'
	) THEN
		ALTER TABLE study.session
			ADD CONSTRAINT session_session_length_check
			CHECK (session_length BETWEEN 3 AND 30);
	END IF;
END $$;

-- ---- scenario: add (user_id, difficulty) index ---------------------------

CREATE INDEX IF NOT EXISTS scenario_user_difficulty_idx
	ON study.scenario (user_id, difficulty);

-- ---- knowledge_node: content_hash + version columns ----------------------

ALTER TABLE study.knowledge_node
	ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE study.knowledge_node
	ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
