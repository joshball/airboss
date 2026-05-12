---
title: Command palette Phase 2 -- security review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: security
status: pending
review_status: done
issues_found: 3
---

# Security review

## Summary

User-scoping gates are present on every `mine.*` loader. The endpoint clamps payload size. ilike escapes are uniform. Two coverage gaps (test) and one concrete attack surface (rate-limiting).

## Findings

### S1. (Critical) No rate-limit on `/api/palette/search`

**File:** `libs/help/src/loaders/endpoint.ts`

The endpoint accepts unauthenticated POSTs. Each call fans out to 8 Postgres queries, several with ilike scans over `content_md` (handbook + CFR + AIM body columns -- the slowest single field in the DB). A single anonymous client can pin the database with a tight `while (true)` loop of `fetch('/api/palette/search', { body: JSON.stringify({ q: 'a' }) })`.

PALETTE_QUERY_MAX_LENGTH = 200 char caps the row of each query, but does nothing for QPS.

**Fix:** apply the existing auth-aware rate limiter to the endpoint. If no rate-limiter middleware exists in this codebase, the minimum bar is one of:

1. Skip running the loaders when `event.locals.user?.id` is absent. The palette is useless without auth (the `mine.*` family is the headline feature), and unauthenticated drive-by traffic should be cheap to reject.
2. Track per-IP request count in `event.locals` / a sliding window and 429 over a threshold.

Option (1) is the lower-blast-radius fix and matches the design intent ("the palette is for end users + admins from any app").

If anonymous palette use is a product requirement, write the rate-limiter; otherwise close the door.

### S2. (Major) `loadPlans` and `loadReps` tests do not verify cross-user isolation

**File:** `libs/help/src/loaders/__tests__/db-loaders.test.ts`

`loadCards` has the test pattern right: seed a card for `OTHER_USER_ID`, seed one for `TEST_USER_ID`, run the loader as `TEST_USER_ID`, assert the other user's card is NOT in the results. (`it('never leaks another user card')`, line 445.)

`loadReps` and `loadPlans` test only the positive (own row present) + the anon (empty when no userId). They do not seed a second user's review/plan and assert the absence. The current loaders gate via `eq(review.userId, host.userId)` / `eq(studyPlan.userId, host.userId)` so the production code is safe. But the regression net does not catch a future "I optimized this query and dropped the userId clause" PR.

**Fix:** mirror the `loadCards` "never leaks" test for reps + plans. Seed a second review tied to `OTHER_USER_ID` + `CARD_OTHER_ID`; seed a second plan owned by `OTHER_USER_ID`; assert the matching needle finds only the `TEST_USER_ID` row.

### S3. (Minor) Unlogged endpoint errors

**File:** `libs/help/src/loaders/endpoint.ts`

`try { body = await event.request.json(); } catch { throw error(400, 'invalid json body'); }` -- the parse error is swallowed. Same for any thrown loader (no try/catch around `loadPaletteInjected`, so a thrown Postgres error becomes a 500 with no server-side trace handle).

**Fix:** log the original error with the request id (if present) before throwing. The SvelteKit `error()` thrower doesn't surface server-side stack traces by default; a `console.error` with `[palette]` prefix is enough for now.

This matters most for the user-facing `Promise.all` failure mode noted in correctness C4: a noisy 500 with no logs is hard to diagnose.

## Out of scope (verified safe)

- ilike pattern escapes are correct (`escapePattern` -- escapes `\`, `%`, `_`). All 8 loaders use it consistently.
- The `q` field is parsed with `typeof q !== 'string'` rejecting non-string payloads.
- PALETTE_QUERY_MAX_LENGTH = 200 truncation prevents giant-needle DoS attempts.
- `host.userId` flows from `event.locals.user?.id` -- can't be spoofed by client payload.
- External tool URLs are static + reviewed in `libs/aviation/src/external-tools.ts` -- no injection vector.
