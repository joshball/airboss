-- One-active-plan-per-user invariant.
--
-- Drizzle's table DSL does not express partial UNIQUE indexes cleanly, so
-- this migration owns the invariant. The study-plan BC also archives any
-- other active plan for the user inside createPlan / activatePlan, but the
-- index is the backstop: a race between two in-flight activations cannot
-- produce two active plans because one INSERT will fail.

CREATE UNIQUE INDEX IF NOT EXISTS plan_user_active_uniq
	ON study.study_plan (user_id)
	WHERE status = 'active';
