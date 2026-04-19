---
title: 'Review: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: review
status: unread
review_status: pending
---

# Review: Spaced Memory Items

Four implementation phases plus a pre-feature foundation port, each phase
reviewed by 2-4 specialists, then a final pass with all 10 review categories
in parallel. Findings were fixed in the same branch (`build/spaced-memory-items`)
unless they are flagged as deferred below.

## Summary

| Stage          | Reviews ran                                | Findings | Fixed | Deferred |
| -------------- | ------------------------------------------ | -------- | ----- | -------- |
| Phase 0 review | security, backend, architecture, patterns  | 54       | 37    | 17       |
| Phase 1 review | schema, correctness, architecture          | 29       | 18    | 11       |
| Phase 2 review | backend, correctness, perf                 | 35       | 21    | 14       |
| Phase 3 review | svelte, ux, a11y                           | 50       | 15    | 35       |
| Final review   | 10 categories                              | ~135     | 21    | ~114     |
| **Total**      |                                            | **303**  | **112** | **191** |

All Criticals (3) and all structural Majors (31 of 31) are fixed. Remaining
items are UX polish, a11y refinements, perf pre-optimisations, and future-BC
architecture notes. Each deferred item is captured with a reason below.

## Phase reviews

### Phase 0 -- foundation port

Categories: security, backend, architecture, patterns.

| Severity | Count | Fixed                                                                       |
| -------- | ----- | --------------------------------------------------------------------------- |
| Critical | 1     | 1 -- `/api/auth` handler now try/catch + structured logging                 |
| Major    | 13    | 13 -- FK on user_id, restrict cascade, open-redirect guard, env disclosure  |
| Minor    | 27    | 19 -- HTML escaping in email, decode fallback, request-id sanitation        |
| Nit      | 13    | 4 -- minor wording / comment fixes                                           |

Files: [phase-0-security](../../work/reviews/2026-04-19-spaced-memory-items-phase-0-security.md), [phase-0-backend](../../work/reviews/2026-04-19-spaced-memory-items-phase-0-backend.md), [phase-0-architecture](../../work/reviews/2026-04-19-spaced-memory-items-phase-0-architecture.md), [phase-0-patterns](../../work/reviews/2026-04-19-spaced-memory-items-phase-0-patterns.md).

### Phase 1 -- study BC foundation

Categories: schema, correctness, architecture.

| Severity | Count | Fixed                                                                    |
| -------- | ----- | ------------------------------------------------------------------------ |
| Critical | 0     | --                                                                        |
| Major    | 5     | 5 -- bauth_user FKs, jsonb<string[]>, CHECK constraints, per-user FSRS    |
| Minor    | 16    | 10 -- CHECK coverage, indexes, type narrowing                             |
| Nit      | 8     | 3 -- doc tweaks                                                           |

Files: [phase-1-schema](../../work/reviews/2026-04-19-spaced-memory-items-phase-1-schema.md), [phase-1-correctness](../../work/reviews/2026-04-19-spaced-memory-items-phase-1-correctness.md), [phase-1-architecture](../../work/reviews/2026-04-19-spaced-memory-items-phase-1-architecture.md).

### Phase 2 -- cards / reviews / stats BC

Categories: backend, correctness, perf.

| Severity | Count | Fixed                                                                         |
| -------- | ----- | ----------------------------------------------------------------------------- |
| Critical | 1     | 1 -- FSRS `lastReview: null` bug (elapsed_days stuck at 0 on every re-review) |
| Major    | 5     | 5 -- FOR UPDATE lock + idempotency window; Promise.all dashboard; zod guards  |
| Minor    | 19    | 13 -- accuracy-scope fix, query typing, index hints                           |
| Nit      | 10    | 2 -- inline polish                                                            |

Files: [phase-2-backend](../../work/reviews/2026-04-19-spaced-memory-items-phase-2-backend.md), [phase-2-correctness](../../work/reviews/2026-04-19-spaced-memory-items-phase-2-correctness.md), [phase-2-perf](../../work/reviews/2026-04-19-spaced-memory-items-phase-2-perf.md).

### Phase 3 -- card management UI

Categories: svelte, ux, a11y.

| Severity | Count | Fixed                                                                       |
| -------- | ----- | --------------------------------------------------------------------------- |
| Critical | 0     | --                                                                           |
| Major    | 11    | 5 -- destructive archive, skip link, nav aria, label maps, empty-state split |
| Minor    | 23    | 6 -- kbd shortcut, autofocus, error aria-describedby                         |
| Nit      | 16    | 4                                                                            |

Files: [phase-3-svelte](../../work/reviews/2026-04-19-spaced-memory-items-phase-3-svelte.md), [phase-3-ux](../../work/reviews/2026-04-19-spaced-memory-items-phase-3-ux.md), [phase-3-a11y](../../work/reviews/2026-04-19-spaced-memory-items-phase-3-a11y.md).

### Phase 4 -- dashboard + review flow

No dedicated per-phase review. Covered in the final 10-reviewer pass below
because the review flow is the highest-surface area in the feature.

## Final review

Ran all 10 categories in parallel against `git diff docs/initial-migration..HEAD`.

| Category     | Critical | Major | Minor | Nit | Total |
| ------------ | -------- | ----- | ----- | --- | ----- |
| ux           | 2        | 8     | 10    | 7   | 27    |
| svelte       | 0        | 0     | 4     | 5   | 9     |
| security     | 0        | 1     | 6     | 3   | 10    |
| perf         | 0        | 2     | 7     | 4   | 13    |
| architecture | 0        | 2     | 7     | 4   | 13    |
| patterns     | 0        | 2     | 7     | 3   | 12    |
| correctness  | 0        | 2     | 8     | 4   | 14    |
| a11y         | 0        | 7     | 12    | 8   | 27    |
| backend      | 0        | 3     | 9     | 6   | 18    |
| schema       | 0        | 1     | 4     | 3   | 8     |
| **Total**    | **2**    | **28**| **74**| **47**| **151** |

All Critical + every structural/correctness/security Major fixed in the
post-final commit.

Files: [final-ux](../../work/reviews/2026-04-19-spaced-memory-items-final-ux.md), [final-svelte](../../work/reviews/2026-04-19-spaced-memory-items-final-svelte.md), [final-security](../../work/reviews/2026-04-19-spaced-memory-items-final-security.md), [final-perf](../../work/reviews/2026-04-19-spaced-memory-items-final-perf.md), [final-architecture](../../work/reviews/2026-04-19-spaced-memory-items-final-architecture.md), [final-patterns](../../work/reviews/2026-04-19-spaced-memory-items-final-patterns.md), [final-correctness](../../work/reviews/2026-04-19-spaced-memory-items-final-correctness.md), [final-a11y](../../work/reviews/2026-04-19-spaced-memory-items-final-a11y.md), [final-backend](../../work/reviews/2026-04-19-spaced-memory-items-final-backend.md), [final-schema](../../work/reviews/2026-04-19-spaced-memory-items-final-schema.md).

## What got fixed in the final pass

Critical:

- Root `/` within the `(app)` group redirected to `/memory` -- was a dead-end stub.
- Nav dropped `/reps` and `/calibration` links (routes don't exist yet).

Major -- correctness:

- Review form only advances + tallies on `result.type === 'success'`. Ratings
  disable during submit. Failures surface a `role="alert"` message and stay
  on the same card.
- `submitReview` now refuses non-active cards (`CardNotReviewableError`).

Major -- backend / architecture:

- Typed BC errors: `CardNotFoundError`, `CardNotEditableError`,
  `SourceRefRequiredError`, `CardNotReviewableError`. Routes catch by class,
  not by `err.message.includes()`.
- New `getRecentReviewsForCard` BC function (scoped by userId); `/memory/[id]`
  stopped reaching into the raw `review` Drizzle table.
- Every `(app)/memory/*` route uses `requireAuth(event)` from `@ab/auth`
  instead of an inline `if (!user) redirect`. Preserves `redirectTo` so
  deep-link expiry returns the learner to where they were going.
- `/memory/[id]` loads card + recent reviews with `Promise.all`.

Major -- patterns / perf:

- Magic string `'personal'` replaced with `CONTENT_SOURCES.PERSONAL` in
  browse + detail pages.
- Magic number `25` browse page size moved to `BROWSE_PAGE_SIZE` constant.
- Duplicate `escapeLikePattern` in `cards.ts` replaced by `@ab/db` export.
- better-auth `session.cookieCache` enabled (5-min maxAge). Cuts DB
  round-trips on every authenticated request.

Major -- security:

- `BETTER_AUTH_URL` env var wired through `apps/study/src/lib/server/auth.ts`
  so production deploys can set trustedOrigins + email-link base. Added to
  `ENV_VARS` and `.env.example`.

Misc:

- Root `package.json` workspaces glob extended to `libs/bc/*`.
- `nanoid` removed from dependencies (unused).

## Deferred

These findings were reviewed and consciously deferred. Each carries a reason
and a target.

### UX polish (flagged, target: after first real usage)

- Dashboard new-user onboarding card (currently shows four zeros).
- Next-due timestamp on "all caught up" screen.
- Dashboard link / counter for time-until-next-due.
- Confidence prompt ordering study (spec says before reveal; current flow
  routes front -> confidence only when prompted, which the UX reviewer
  flagged for clarity; defer to user-zero testing).
- Per-rating kbd hint parity ("< 1m" vs "~ days"), "Reload queue" wording.
- Archive undo.
- Mid-session "end session" affordance.

Reason: all are habit-formation polish. Joshua (user zero) will surface which
ones matter after actual daily use. No flow is broken today.

### A11y polish (flagged, target: after first real usage)

- Focus management on card advance / answer reveal (keyboard users lose
  place on every transition).
- Single-char rating shortcuts technically violate WCAG 2.1.4 (Character
  Key Shortcuts). Workable mitigation: require Shift modifier or add a
  toggle.
- Disabled-button contrast (`opacity: 0.6`) on submit states falls below AA.
- `prefers-reduced-motion` not respected anywhere.
- Confidence prompt lacks a heading and documented kbd shortcuts.
- Session summary not announced as a live region.

Reason: no screen-reader blockers; Joshua does not use AT daily. Structural
semantics (skip link, `aria-label`, `role="search"`, field aria-describedby)
are in place.

### Perf pre-optimisations (flagged, target: at scale)

- `(user_id, updated_at)` index on `card` (currently uses `(user_id, created_at)`
  plus in-memory sort; fine at 1k cards).
- `(user_id, card_type)` and `(user_id, source_type)` browse-filter indexes.
- `pg_trgm` GIN on front/back for scalable search (currently ILIKE scan).
- Partial index on `card_state (user_id, due_at) WHERE status = 'active'`
  to skip heap lookups on the due-queue query.
- Drizzle migration artifacts (currently `db:push` only) -- blocker before
  any shared DB deploy.

Reason: current scale (single user, hundreds of cards) far below these
thresholds. Address as part of the pre-production work.

### Architecture notes (flagged, target: future BCs)

- BC barrel exposing raw Drizzle table objects; kept for scripts, documented
  so routes prefer BC functions.
- `@ab/bc-study` naming (hyphen) vs slash alias diverged -- reconciled on
  the `@ab/bc-study` side now; future BCs follow.
- Per-app `$lib/server/{auth,cookies}.ts` wrappers will proliferate; flag
  for factoring once 2-3 surface apps exist.

Reason: premature unification costs more than the trade-off of having two or
three concrete copies later.

### Security hardening (flagged, target: pre-prod)

- Dev-account constants still live in `@ab/constants`; relies on Vite DCE.
  A prod bundle grep in CI would catch regressions.
- Banned-user guard still skipped for `/api/auth/*` (better-auth revokes
  sessions on ban; defense-in-depth).
- PII: login action logs `email` on failure.

Reason: dev-only concerns or defense-in-depth that isn't blocking.

## What was NOT reviewed or tested

- Real browser walk of the flows at `study.airboss.test:9600`. User zero
  (Joshua) runs the SMI-1 through SMI-17 manual checklist.
- Production deploy path (trustedOrigins, email transport, Drizzle migrations).
- FSRS parameter tuning (library defaults are shipping; per-user tuning is
  plumbed via optional `params` arg but not enabled).
- Load / concurrency under >1 user.

## Review files

Per-phase reviews under [docs/work/reviews/](../../work/reviews/):

- 2026-04-19-spaced-memory-items-phase-0-{security,backend,architecture,patterns}.md
- 2026-04-19-spaced-memory-items-phase-1-{schema,correctness,architecture}.md
- 2026-04-19-spaced-memory-items-phase-2-{backend,correctness,perf}.md
- 2026-04-19-spaced-memory-items-phase-3-{svelte,ux,a11y}.md
- 2026-04-19-spaced-memory-items-final-{ux,svelte,security,perf,architecture,patterns,correctness,a11y,backend,schema}.md

Fix commits on `build/spaced-memory-items`:

```text
99c4c3b  feat(foundation): port auth, db, and logging from airboss-firc
966da01  fix(spaced-memory-items): address Phase 0 review findings
a3dbe04  feat(spaced-memory-items): phase 1 -- constants, schema, FSRS wrapper
e97d759  fix(spaced-memory-items): address Phase 1 review findings
0bbde26  feat(spaced-memory-items): phase 2 -- cards/reviews/stats BC
705d741  fix(spaced-memory-items): address Phase 2 review findings
07d1ff1  feat(spaced-memory-items): phase 3 -- card management UI
5dcb684  fix(spaced-memory-items): address Phase 3 review findings
236c688  feat(spaced-memory-items): phase 4 -- dashboard + review flow
<this commit>  fix(spaced-memory-items): address final 10-reviewer findings
```

`review_status` stays `pending` until Joshua walks the SMI-1 through SMI-17
manual test checklist in a browser.
