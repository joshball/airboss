---
status: unread
review_status: pending
---

# Study surface -- 10x review (2026-05-17)

Scope: `apps/study/`, `libs/bc/study/`, `libs/help/` (~138k LOC). The study
app is the active MVP surface. Reviewed for correctness, type safety,
security, architecture / BC boundaries, browser-safety, Svelte 5 pattern
compliance, performance, accessibility, UX states, DX, and test quality.

## Summary

The study surface is in strong shape. No Svelte 4 legacy
(`export let` / `<slot>` / `$:` / `$app/stores` / `createEventDispatcher`),
no non-null assertions, no `: any` outside test fixtures and JSDoc, no hex
colors / inline `ms` / `px` font-sizes in components, no `.toBeTruthy()`,
no skipped or no-op tests. The runtime-barrel / `/server`-barrel split for
`@ab/bc-study` and `@ab/help` is intact -- `check-browser-globals` passes.
Auth follows the documented dual-gate contract. API endpoints validate input
with zod, rate-limit, and cap body size.

Findings below are all fixed in the accompanying PR. The dominant theme is a
convergent one: **raw `db.execute(sql\`...\`)` queries embedded in route
server files**, bypassing both Drizzle ORM (a critical project rule) and the
BC boundary. Four sites, one root cause.

## Major

### M1 -- Raw 500 error message leaked to the client

`apps/study/src/routes/(app)/study/+page.server.ts` `setPref` action:

```ts
} catch (err) {
  return fail(500, { ok: false, error: (err as Error).message });
}
```

A failed `setUserPref` write surfaces the raw DB / driver error text to the
browser. Per common-pitfalls backend #4, 500s map to a fixed user string and
the raw error is logged server-side via `createLogger`.

Fix: catch, log with `createLogger('study:home')`, return a fixed
`'Could not save preference.'`.

### M2 -- Raw SQL + BC-boundary violation: `resolveGoalPrimaryCredential`

Same file: `resolveGoalPrimaryCredential` runs a hand-written
`db.execute(sql\`SELECT ... FROM study.goal_syllabus JOIN ...\`)` directly in
the route, then casts the result `as unknown as Row[]`. Both `goalSyllabus`
and `credentialSyllabus` already have Drizzle table definitions, and `goals.ts`
already imports them.

Fix: new `getGoalPrimaryCredentialId(goalId, db)` BC function in
`libs/bc/study/src/goals.ts` using a typed Drizzle join; route calls it.

### M3 -- Raw SQL: `resolveKnowledgeSlugsToIds` reinvents `getNodesByIds`

`apps/study/src/routes/(app)/study/_lib/build-course-tree.server.ts` builds a
raw `SELECT id FROM study.knowledge_node WHERE id = ANY(...)` query. The BC
already exports `getNodesByIds(ids)` doing exactly this.

Fix: call `getNodesByIds` from `@ab/bc-study`.

### M4 -- Raw SQL: `resolveAcsCodesToLeafIds`

Same file: raw `SELECT id, code FROM study.syllabus_node WHERE code = ANY(...)`.

Fix: new `getSyllabusNodesByCodes(codes, db)` BC function in `syllabi.ts`;
route maps the typed rows.

### M5 -- Raw SQL: `build-today-briefing.server.ts` node-title lookup

`SELECT title FROM study.knowledge_node WHERE id = ... LIMIT 1` embedded in
the briefing builder.

Fix: new `getKnowledgeNodeTitles(ids, db)` BC function in `knowledge.ts`
returning an id -> title map; route reads from it.

## Minor

### m1 -- Raw SQL column-name string in `snooze.ts`

`getUnresolvedReEntrySnooze` uses `sql\`"card_edited_at" IS NOT NULL\`` -- a
literal column name in a WHERE clause. `cardSnooze.cardEditedAt` exists; a
column rename would break this string silently.

Fix: `isNotNull(cardSnooze.cardEditedAt)`.

### m2 -- Inline route string

`study/+page.server.ts:110`: `throw redirect(302, '/study')`. All routes go
through `ROUTES`.

Fix: `ROUTES.STUDY_HOME`.

### m3 -- Raw error text leaked from drafts `promote`

`memory/drafts/+page.server.ts` `promote` action: after the typed-error
branches, `if (err instanceof Error) return fail(400, { error: err.message })`
leaks raw text for any non-typed `Error` (e.g. a DB failure).

Fix: log the raw error, return a fixed `'Could not promote draft.'`.

### m4 -- Raw `window.confirm()` on a destructive action

`memory/drafts/+page.svelte` Discard button calls `confirm(...)` in an
`onclick`. Common-pitfalls a11y: destructive actions wrap in `<ConfirmAction>`.
Every other destructive action in the study app (`sessions/[id]`,
`program/plans/[id]`, `memory/+page`, `CardDetailPanel`) uses `ConfirmAction`.

Fix: replace with `<ConfirmAction>`.

### m5 -- `redirect()` inside a `try` in drafts `promote`

`promoteDraftToCard` succeeds, then `redirect(303, ...)` is called inside the
`try`. SvelteKit's `redirect()` throws; the `catch` sees it, `err instanceof
Error` is false (a `Redirect` is not an `Error`), so it falls through to
`throw err`. It works, but only by luck of structural shape. Common-pitfalls
backend: re-throw redirects explicitly with `isRedirect`.

Fix: guard the catch with `isRedirect(err)` re-throw, or move the redirect
after the try. Restructured so the redirect is unambiguous.

## Nits

Folded into the fixes above (no separate nit-only items survived the pass).

## Not changed (verified acceptable)

- `api/charts/[...slug]` is unauthenticated and serves SVG. Content is from
  the project's own corpus, slug shape is tightly banded, path traversal is
  blocked lexically and by a resolved-root re-check. Acceptable.
- `api/client-error` `content-length` pre-check can be bypassed by omitting
  the header, but every field has a zod `.max()` and the route does no
  unbounded work before validation. Acceptable.
- The `login/+page.svelte` `$effect` that re-seeds `email` from `form` is the
  documented correct pattern (the action deliberately blanks email on 401).
- Engine PRNG constants (`2166136261`, `16777619`, `0x6d2b79f5`,
  `4294967296`) are canonical mulberry32 / fnv-1a algorithm constants, not
  scoring tuning -- they correctly stay out of `ENGINE_SCORING`.
- GIN-index operator-class `sql\`...\`` strings in `schema.ts` cannot be
  expressed through Drizzle's column DSL; acceptable.
