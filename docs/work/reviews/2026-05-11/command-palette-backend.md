---
title: Command palette Phase 2 -- backend review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: backend
status: pending
review_status: done
issues_found: 3
---

# Backend review

Server load functions, form actions, API design, data flow, error responses.

## Findings

### B1. (Major) `/api/palette/search` mounted at four paths -- one shared handler, four identical files

**Files:**

- `apps/study/src/routes/api/palette/search/+server.ts`
- `apps/sim/src/routes/api/palette/search/+server.ts`
- `apps/hangar/src/routes/(app)/api/palette/search/+server.ts`
- `apps/flightbag/src/routes/api/palette/search/+server.ts`

Each file is 9-11 lines: a one-line `import`, a one-line `export const POST = (event) => handlePaletteSearch(event, APP_SURFACES.X)`. This is the right pattern -- each app needs its own SvelteKit endpoint, the surface tag is per-app. But two things are subtly different:

1. Hangar mounts under `(app)/` (the auth-guarded route group), the other three don't. Study and sim are auth-optional today; hangar requires auth. For hangar, anonymous requests will be rejected before the palette loader runs. For study/sim/flightbag, anonymous requests reach the loader -- the `mine.*` family returns `[]` (correct), but the load on Postgres for an anonymous request is still 8 queries (4 of them ilike body scans). See security S1.

2. Flightbag uses `APP_SURFACES.LIBRARY` not `FLIGHTBAG` (no `FLIGHTBAG` in `APP_SURFACES`). This is a vocabulary mismatch the WP didn't catch: spec talks about "the palette is for end users + admins from any app" with apps `study / sim / hangar / flightbag / avionics`, but `APP_SURFACES` is a different enum -- it tracks "page-area within an app" (dashboard / memory / reps / calibration / library / hangar / global). The host's surface tag is whatever each app picks; today loaders `void` the host, so the value doesn't matter, but Phase 4's per-app boost will read it. Document the choice now.

**Fix:**

1. (security S1): close the auth gate, or rate-limit by IP.
2. Add a comment in each `+server.ts` explaining the surface choice. Or extend `APP_SURFACES` with explicit values for `study` / `sim` / `flightbag` and pick them. (Watch the lint script: `APP_SURFACE_LABELS` is exhaustive over `AppSurface`, so any new value needs a label.)

### B2. (Minor) Error response shape is plain SvelteKit `error()` -- no machine-readable code

**File:** `libs/help/src/loaders/endpoint.ts` (lines 30-35)

```ts
try { body = await event.request.json(); } catch { throw error(400, 'invalid json body'); }
if (typeof body !== 'object' || body === null) throw error(400, 'invalid body shape');
const q = (body as { q?: unknown }).q;
if (typeof q !== 'string') throw error(400, 'missing q');
```

SvelteKit `error()` serializes as `{ message: 'invalid json body' }`. The client only checks `if (!res.ok) return;` -- silently swallowing 4xx. That's defensible but leaves the user with no feedback when something is genuinely wrong (e.g. a bug in `JSON.stringify` from the client).

**Fix:** lift error responses to a typed shape:

```ts
throw error(400, { code: 'invalid-json-body', message: 'Request body must be valid JSON' });
```

The SvelteKit `App.Error` type may need to be extended in `app.d.ts` to allow the object form. Verify before changing.

For Phase 2: acceptable as-is given the client doesn't display errors anyway. Document the punt; revisit when the detail pane lands and the user can see why a query failed.

### B3. (Minor) Response shape `{ results }` without versioning

**File:** `libs/help/src/loaders/endpoint.ts` (line 44)

The response is `{ results: SearchResult[] }`. No version field, no metadata (query echo, took-ms, total). The client's only contract is `Array.isArray(data.results)`.

When Phase 3 / 4 land, the response shape probably grows (clusters, recents, command results, host echo). The current shape is too minimal to extend without a client coordination dance.

**Fix:** wrap in `{ version: 1, query: q, results: SearchResult[], debug?: { tookMs: number } }`. The client guards on `version` so a server roll-forward without a client roll-forward gracefully degrades.

Not blocking for Phase 2; surface as a follow-up when the contract is extended.

## Out of scope (verified clean)

- POST verb matches the body-bearing semantics (a 200-char `q` is at the upper end of what fits comfortably in a URL).
- `event.locals.user?.id` is the canonical SvelteKit session lookup; no manual session parsing.
- `handlePaletteSearch` is mounted via the shared `handlePaletteSearch` helper rather than duplicated per app -- the right boundary.
- No DB transactions / writes -- read-only endpoint. No race conditions to audit.
