---
status: unread
review_status: done
date: 2026-05-05
scope: bc-study barrel split + client-error classification + lint guard augmentation
diff: ~106 files (90 import-site swaps, 4 new files, 12 substantive edits)
---

# bc-study barrel split -- 10x review (consolidated)

## Stack-aware reviewer pass

Single-pass walk through the ten specialist checklists in `/ball-review-10x` against the diff. Findings are grouped by category; each line is one issue plus disposition.

## 1. UX

- `+error.svelte` and `(app)/+error.svelte` now branch on `kind === 'client'` to drop the misleading status row and add a requestId reference. **Done in this PR.** Verified: HTTP 4xx/5xx still render the status code; client-classified errors render "App error" only.
- The requestId is rendered with `font-family-mono` and labelled "Reference:" so a learner can quote it to support without explaining what it is. **Done.**
- The de-dupe shim (5s window) ensures that a hydration crash that fires both `handleError` and `window.onerror` produces one user-visible report log entry, not two. **Done.**
- Dropped: a "Try reloading" affordance. The boundary already has a Back-home / Back-to-dashboard primary; reload is the browser's job and adding a button risks pretending we know it'll help.

## 2. Svelte (runes / patterns)

- All `+error.svelte` derivations use `$derived(...)` (Svelte 5). No `$:`, no stores. **Verified.**
- `+layout.svelte` keeps `$props()` and `onMount` lifecycle. The dedupe + report helpers were extracted to `$lib/client-error-reporter.ts` (a non-rune module) and called from `onMount`. **Verified.**
- `hooks.client.ts` is plain TS (not a `.svelte.ts`); no rune use needed -- it's just a function export. **Verified.**

## 3. Security

- `+error.svelte` keeps `isUserSafeMessage()` -- raw error messages over 200 chars, multi-line, or stack-shaped are replaced with the generic copy. The new branch (`kind === 'client'`) goes through the same gate. **Verified.**
- The new `client-error-reporter.ts` shares fingerprint state across both reporting pipelines; the fingerprint is `${message} ${stack.slice(0,200)}`. There's no PII risk because `message` and `stack` are exactly what the existing `+layout.svelte` already POSTed.
- The `/api/client-error` endpoint, which both pipelines call, was already in place from PR #656 with rate-limit + body-size + zod validation. The new hook reuses the same payload schema; no new endpoint, no new attack surface.
- Build/server barrel split closes a defense-in-depth concern: the runtime barrel no longer re-exports server-only mutators that bypass actor scoping. The existing `barrel-split.test.ts` continues to enforce `runtime ∩ build = {}`; the new `server.ts` doesn't change that test.

## 4. Performance

- The runtime barrel now ships ~70% less code (753 → 377 lines, almost all of the trim is type-only re-exports of server-only modules). Vite's deps optimizer no longer pulls calibration/dashboard/scenarios/etc. (and their `@ab/db/connection` chain, hence `postgres`) into the client bundle. The original `Buffer is not defined` regression's root cause is gone.
- `server.ts` re-exports everything from `index.ts` plus the server-only modules. Server-side imports remain a single line. No new round-trip cost.
- The `client-error-reporter` dedupe shim uses a small array (capped by the 5s window) and walks linearly. Anything more than a handful of distinct errors per 5s is extraordinary; O(N²) walk is fine for the shape.

## 5. Architecture / BC boundaries

- The split obeys the existing convention (browser-safe vs server-only vs build-only) and adds the third entry point (`/server`) cleanly. The runtime barrel re-exports `type`-only from server-only modules so existing `import type { Foo } from '@ab/bc-study'` lines in `.svelte` files keep working without touching them.
- `lenses.ts` and `engine.ts` (pure modules) and `schema.ts` (Drizzle table objects, no postgres) stay browser-safe. **Verified by grep: no `@ab/db/connection` import.**
- `validateSyllabusTree` is a pure function but lives in `syllabi.ts` which imports `@ab/db/connection`; pulling it into the runtime barrel would re-leak postgres. Stayed at `/server`. Cost: callers needing this pure function from a `.svelte` page would have to extract it; today no caller exists.

## 6. Patterns / project conventions

- Routes via `ROUTES.API_CLIENT_ERROR`. **Verified.**
- New constants in `libs/constants/src/client-errors.ts`, re-exported from the index. No magic strings in the boundary or hook. **Verified.**
- Cross-lib imports use `@ab/*` aliases. **Verified.**
- `bun run check` clean (only the accepted-baseline errors remain: `fast-xml-parser`, `@ab/aviation`, `three`, `@ab/bc-sim/persistence`, `libs/help/search.ts implicit-any`). **Verified.**
- Biome format applied to all touched files. **Verified.**

## 7. Correctness

- `hooks.client.ts` returns `{ kind, message, requestId, status }`. SvelteKit threads this through `page.error`. The boundary reads `page.error?.kind` (optional chaining; undefined for legacy / server-thrown errors).
- The dedupe set is mutated on read (push-on-miss). Both pipelines call the same exported `shouldSkipDuplicate`. Race-free: the browser's event loop is single-threaded, so two `error` events cannot interleave inside the function body.
- Long-stack fingerprint truncates at 200 chars to avoid line-column noise producing false negatives. Test covers the equivalence-by-prefix case.
- `crypto.randomUUID()` is browser-safe (Node 19+, all modern browsers).

## 8. Accessibility

- Error boundaries keep `role="alert"` on the card. **Verified.**
- The requestId line uses `<code>` for the value; the label "Reference:" is plain text so SR users hear it. **Verified.**
- No new keyboard-trap risks -- the boundary is unchanged in interactive surface.

## 9. Backend

- The `/api/client-error` endpoint is unchanged. The dedupe shim runs in the browser; the server still gets one POST per unique error within the dedupe window. Rate-limit + payload-size guards from PR #656 remain.
- `hooks.client.ts` adds no server load -- it's purely client-side; the only network call is the existing `/api/client-error` POST, gated by the new dedupe.

## 10. Schema

- No DB schema changes. Drizzle table objects stay in `schema.ts` and are re-exported as values from the runtime barrel because `pg-core` is browser-safe. **Verified by check-browser-globals lint clean.**

## Convergent findings

- "Token migration stopped at primitives" pattern: not applicable here -- this PR doesn't touch theme tokens.
- "Lint guard catches the bare-globals regression but not the import-graph regression": **fixed.** `scripts/check-browser-globals.ts` now scans for runtime imports of `@ab/db/connection`, `@ab/bc-study/server`, `@ab/bc-study/build`, `postgres`, `node:*` from any client-eligible file under `apps/*/src/**`. Type-only imports allowed.

## Outstanding -- none

No items survive without disposition. The lint guard's static-import scan won't catch every transitive case (the original leak was transitive via barrel re-exports), but the runtime-barrel test in `barrel-split.test.ts` stays the structural guard, and the new lint guard catches the next *direct* regression cleanly. That trade-off is documented in the script header.

## Manual reproduction status

Live `/memory` browser test was not run from inside the worktree (avoided port collision with the dispatcher's running dev server). Static evidence:

- Grep of `.svelte` files for `@ab/bc-study` imports shows only browser-safe values (`summarizeDeckSpec`, `formatNextInterval*`).
- `scripts/check-browser-globals.ts` clean.
- `barrel-split.test.ts` continues to assert runtime ∩ build = {} (test runs into the pre-existing `fast-xml-parser` baseline issue at module load, same as on main).
- Type check (`bun run check`) clean modulo accepted baseline.

Recommend the user smoke-test `/memory` post-merge to confirm the runtime fix; the static evidence is consistent with the runtime fix landing.
