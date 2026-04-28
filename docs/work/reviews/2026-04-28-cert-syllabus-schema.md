---
title: 'Review: cert-syllabus-and-goal-composer (schema)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: schema
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 3
---

# Review: cert-syllabus schema

## Major (0)

(none)

## Minor (3)

### m1 -- `credential_prereq.created_at` set per row but no `updated_at`; `notes` is mutable

`libs/bc/study/src/schema.ts:1421-1446`. The composite-PK table tracks `created_at` but `notes` is updated by `upsertCredentialPrereq`. Without an `updated_at`, audit / dev-seed cleanup queries can't tell when the row was last touched. Same for `credential_syllabus`, `goal_syllabus`, `goal_node`, `syllabus_node_link` -- all link tables share this shape.

**Fix:** either drop the `notes` mutation path (treat the rows as immutable; new edges on YAML change require a delete + insert), or add `updated_at` to the link tables. Immutable is simpler; the seed paths already use `onConflictDoUpdate` only to refresh `notes`/`weight`/`primacy`.

This is a follow-on consideration; nothing breaks today. Capture as a future ADR or drop it.

**Resolution:** Drop. The seed currently re-runs idempotently and the `notes` field carries authoring-only context that's diff-visible in YAML. Adding `updated_at` would be cosmetic for now. Consider in the next schema review pass.

### m2 -- `syllabus.edition` is `notNull` but free-form for school/personal syllabi

`libs/bc/study/src/schema.ts:1500`. ACS / PTS use the FAA publication slug; school / personal syllabi have no meaningful edition. The CHECK / unique constraint excludes them via `WHERE kind IN ('acs', 'pts')`. So school/personal rows store an empty string or arbitrary text and the constraint is silently OK with it. Not wrong, but the field semantics differ by `kind`.

**Fix:** allow null for non-ACS/PTS rows. Migration: `ALTER COLUMN "edition" DROP NOT NULL`. Add CHECK: `(kind IN ('acs','pts') AND edition IS NOT NULL) OR (kind NOT IN ('acs','pts'))`.

**Resolution:** Defer. The current `notNull` matches the spec ("free-form text for school / personal syllabi") and forces authors to think about edition naming for non-FAA syllabi. Drop.

### m3 -- `goal.target_date` is a `timestamp with time zone` but spec says "free-form authored target"

`libs/bc/study/src/schema.ts:1734` stores `targetDate: timestamp('target_date', { withTimezone: true })`. Spec says "Free-form target date authored by the learner ('2026-12-31')". A learner's target is a calendar date, not a TZ-aware moment. As stored, "2026-12-31" arrives as `2026-12-31 00:00:00+00`, which renders as the prior day in negative-UTC time zones.

**Fix:** change to `date` type, or document that the field is interpreted as midnight UTC and the UI renders in UTC.

**Resolution:** Fix it. The field is single-day intent; `date` is correct. Migration: `ALTER COLUMN "target_date" TYPE date USING (target_date::date)`. Update `goals.ts:243, 278` to stop wrapping in `new Date(...)`.

## Notes

- `syllabus_node.classes` jsonb with the contained-by `<@` CHECK against a literal class list (`drizzle/0004_*.sql:3`) is clever and correct. The `jsonStringArray` helper in `schema.ts:121` keeps the SQL generation safe.
- The partial UNIQUE indexes (`credential_syllabus_primary_unique`, `goal_user_primary_unique`) correctly enforce at-most-one-primary semantics.
- All FK `onDelete` choices are sound (`restrict` for prereq parents and knowledge nodes, `cascade` for child rows under their owning syllabus / goal).
- GIN index on `regulatory_basis` and `citations` makes the reverse-citation queries index-backed -- good forward-thinking.
- The `is_leaf` denormalisation with the `requiredBloomLeafCheck` keeps the hot lens-rollup query fast without losing consistency.
