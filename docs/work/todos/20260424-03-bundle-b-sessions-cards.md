---
session: 2026-04-24
bundle: B
branch: bundle-b-sessions-cards
---

# Bundle B -- review-sessions Resume + public card page + cross-refs

Scope: `docs/work-packages/review-sessions-url/spec.md` layer (a) + `docs/work-packages/card-page-and-cross-references/spec.md`.

## Done

- `study.memory_review_session` table (migration `0004_dark_red_ghost`).
- `study.review.review_session_id` pointer + FK + index (same migration).
- Constants: `REVIEW_SESSION_STATUSES`, `REVIEW_SESSION_STATUS_VALUES`, `REVIEW_SESSION_ABANDON_MS`.
- Routes: `ROUTES.MEMORY_REVIEW_SESSION(id)`, `ROUTES.CARD_PUBLIC(id)`.
- ID generator: `generateReviewSessionId` (`mrs_` prefix).
- BC functions:
  - `startReviewSession`, `resumeReviewSession`, `advanceReviewSession`, `abandonStaleSessions`
  - `getLatestResumableSession`, `getSessionsForCard`, `computeDeckHash`
  - `getPublicCard`, `getCardCrossReferences`
  - `submitReview` gained `reviewSessionId`.
- Routes:
  - `/memory/review` -> creates session, redirects to `/memory/review/<id>`
  - `/memory/review/[sessionId]` -> session-scoped review chrome
  - `/cards/[id]` -> public card page, auth-bypassed by being outside `(app)/`
- UI:
  - Cross-references panel on `/memory/[id]` (4 rows, honest empty states)
  - Share button + toast on `/memory/[id]`
  - Open public view link on `/memory/[id]`
  - "Resume your last run" tile on `/memory`

## Explicitly deferred (per spec)

- review-sessions-url layer (b) Redo: filter-hash encoder, `?deck=<hash>` resolver, resume-vs-fresh prompt.
- review-sessions-url layer (c) Share: popover with Copy + Report on the review screen.
- Cross-refs reps/plans/scenarios rows: each renders "coming soon" until the underlying data source exists (`content-citations` for scenarios; no work package yet for reps-to-card or plan-to-card enrollment).

## Verification

- `bun run check` clean.
- `bun test` via vitest: 1244 passed (with DATABASE_URL set for DB-backed tests).
- Migration `drizzle/0004_dark_red_ghost.sql` applies cleanly.
