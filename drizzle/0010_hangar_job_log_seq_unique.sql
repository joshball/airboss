-- Atomic per-job log seq for hangar.job_log (chunk-6 schema critical fix)
--
-- `hangar.job_log.(job_id, seq)` previously had only a non-unique index, and
-- `appendJobLog()` computed `seq = MAX(seq)+1` non-atomically. The worker's
-- per-handler `makeContext` carried a separate in-memory counter, and the
-- no-handler terminal-event path hardcoded `seq: 0`. Concurrent appenders
-- (orphan-recovery loop + a draining worker for the same job, or any two
-- handler paths writing concurrently) could observe the same MAX(seq) under
-- the default READ COMMITTED isolation and produce duplicate `(job_id, seq)`
-- rows. The polling cursor `seq > sinceSeq` then drops one of any colliding
-- pair on the next page, silently losing log lines.
--
-- The application-side fix is in `libs/hangar-jobs/src/enqueue.ts`:
-- `appendJobLog` now opens a transaction, takes a `FOR UPDATE` row lock on
-- the parent `hangar.job` row, computes `MAX(seq)+1` inside that lock, and
-- inserts the row. The worker's `makeContext` and the no-handler path both
-- route through this single helper, so there is exactly one seq generator
-- per `(jobId, transaction)`.
--
-- This migration adds the schema-side safety net:
--   1. UNIQUE constraint on `(job_id, seq)` -- if any future path bypasses
--      `appendJobLog` and races, the offender fails fast with 23505 instead
--      of silently corrupting the cursor.
--   2. Drops the now-redundant `hangar_job_log_job_idx`. The unique
--      constraint creates an equivalent backing B-tree on `(job_id, seq)`,
--      so per-job tail reads still hit a covering index.
--
-- Idempotent: re-runnable against a database that already has the
-- constraint or has already dropped the old index.

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'hangar_job_log_job_seq_unique'
	) THEN
		ALTER TABLE "hangar"."job_log"
			ADD CONSTRAINT "hangar_job_log_job_seq_unique" UNIQUE ("job_id", "seq");
	END IF;
END $$;

DROP INDEX IF EXISTS "hangar"."hangar_job_log_job_idx";
