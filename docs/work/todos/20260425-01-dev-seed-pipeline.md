# 2026-04-25 -- Dev seed pipeline + Abby + content

## Goal

Make `bun run db reset` produce a non-empty study experience: safety scaffolding so dev seeds cannot pollute production, Abby as the canonical dev-seed test learner, and depth-first CFI-quality content across three study domains (VFR weather, airspace, emergency procedures).

## Layers shipped

- [x] Layer 1 -- `seed_origin` markers on `study.card`, `study.scenario`, `study.study_plan`, `study.session`, `study.session_item_result`, `study.review`, `study.knowledge_node` (column); `bauth_user.address->>'seed_origin'` (jsonb path, since better-auth owns the table). Migration `drizzle/0007_seed_origin_columns.sql` generated.
- [x] Layer 2 -- Yellow CLI warning printed by the seeder before the Abby phase, with computed (not hard-coded) per-table counts.
- [x] Layer 3 -- Production guard module (`scripts/db/seed-guard.ts`) with vitest tests (`seed-guard.test.ts`, 14 tests). Refuses to run when `NODE_ENV=production` AND host is not in `DEV_DB_HOST_ALLOWLIST` / `*.local`. Bypass requires `--i-know-what-im-doing` AND interactive `yes`. Constants live in `libs/constants/src/dev.ts`.
- [x] Layer 4 -- `bun run db seed:remove --origin <tag>` (atomic, FK order, default tag `dev-seed-2026-04-25`) and `bun run db seed:check` (per-table summary, exit 0 clean / exit 1 dirty, CI-safe). Both work in any environment.
- [x] Layer 5 -- Abby (`abby@airboss.test`) added to `DEV_ACCOUNTS`. Existing `learner@airboss.test` row left intact.
- [x] Layer 6 -- 18 personal cards across airspace + emergencies + VFR-mins reasoning, 16 scenarios (6 VFR mins, 6 airspace, 4 emergencies), 1 active plan, 3 historical sessions (6 days ago, 3 days ago, yesterday), 10 reviews + 18 SIR rows. Calibration is deliberately uncalibrated (overconfident regs ~55% accuracy at conf 5; underconfident emergencies at conf 1-2 with ~75% accuracy; well-calibrated airspace at conf 3 ~70%).

## Acceptance verified

- [x] `bun run db seed` runs end-to-end on the dev DB and emits the yellow banner.
- [x] `bun run db seed:remove` cleanly wipes every Abby-seed row, in FK order, atomic.
- [x] `bun run db seed:check` returns exit 0 on a clean DB, exit 1 with per-table summary after seeding.
- [x] Production guard tests pass (14/14).
- [x] `bun run test` 1522/1522 pass.
- [x] Re-seed is idempotent.

## Notes

- Theme-lint failures in `bun run check` are pre-existing in `apps/sim/**` and unrelated to this work (the task explicitly says do not touch sim files).
- `bauth_user.seed_origin` lives in the existing `address` jsonb because better-auth owns the table; production rows always have `address->>'seed_origin' IS NULL`.
- The CFI-credibility goal: every card / scenario citation is to a real CFR §, AIM section, AC, or FAA handbook chapter. No invented references.
