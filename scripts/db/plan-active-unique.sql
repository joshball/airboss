-- One-active-plan-per-user invariant.
--
-- HISTORICAL: the partial UNIQUE index is now expressed in Drizzle DSL on
-- `studyPlan` in libs/bc/study/src/schema.ts (`planUserActiveUniq`), so
-- `bun run db push` creates it on fresh environments. This file survives
-- as an idempotent one-shot for databases provisioned before that change.
-- `IF NOT EXISTS` means re-running it is a no-op.

CREATE UNIQUE INDEX IF NOT EXISTS plan_user_active_uniq
	ON study.study_plan (user_id)
	WHERE status = 'active';
