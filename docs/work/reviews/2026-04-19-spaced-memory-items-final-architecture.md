---
title: 'Final Architecture Review: spaced-memory-items'
date: 2026-04-19
phase: final
category: architecture
feature: spaced-memory-items
branch: build/spaced-memory-items
base: docs/initial-migration
head: 236c688
reviewer: architecture
scope: whole-feature
review_status: done
status: unread
---

# Final Architecture Review -- spaced-memory-items

Scope: the full `build/spaced-memory-items` branch, diffed against
`docs/initial-migration`. Nine commits across four phases; 83 files touched;
~9,800 net added lines. This review looks at architectural shape only --
library boundaries, dependency direction, lib vs app split, BC extensibility,
and the patterns that will need to survive the next few surface apps.

Earlier per-phase reviews (phase-0 -> phase-3) covered this branch in detail
as it landed; each phase's Critical/Major findings were addressed in the
follow-up fix commit before the next phase started. This pass is the final
"walk the whole thing" read -- is the architecture still sound now that all
four phases are in one branch, and is it extensible to the next products
without a refactor round.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical |     0 |
| Major    |     2 |
| Minor    |     7 |
| Nit      |     4 |

**Overall:** architecturally sound. The core structure the design doc called
for -- one `libs/bc/study/` BC, a thin route layer that talks to the BC
barrel, BC functions that accept an optional `db` for transaction injection,
validation shared between BC and routes, `source_type/source_ref/is_editable`
on cards as the forward-compat hook for ADR 011's knowledge graph -- is
exactly what exists on disk. Dependency direction is clean
(`constants -> utils -> db -> auth -> bc/study -> app`). Cross-lib imports go
through `@ab/*` aliases everywhere inside `libs/`.

The two Major findings are both "a pattern that will hurt more as it
replicates." The biggest is a route that bypasses the BC barrel and runs raw
Drizzle on study tables -- a small hole today, a habit that will rot the
whole BC boundary once reps and calibration land. The second is the workspace
glob in the root `package.json`, which doesn't match `libs/bc/*` and so the
BC isn't a real Bun workspace package even though it has a `package.json`.
Aliases cover for this today; the moment a second BC lib ships it starts
producing inconsistency.

---

## Findings

### [MAJOR] Route handler bypasses the study BC barrel and queries `review` directly

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:1,10-12,32-47`

The card detail route imports the raw `review` Drizzle table and the `db`
handle from `@ab/bc-study` and `@ab/db`, then runs this query inline in
`load`:

```typescript
import { getCard, review, setCardStatus, updateCard, updateCardSchema } from '@ab/bc-study';
import { db } from '@ab/db';
// ...
const recentReviews = await db
    .select({ id: review.id, rating: review.rating, ... })
    .from(review)
    .where(eq(review.cardId, params.id))
    .orderBy(desc(review.reviewedAt))
    .limit(10);
```

Four problems stack here:

1. **Leaky boundary.** Every other route in the feature reads through BC
   functions (`getCard`, `getCards`, `getDueCards`, `getDashboardStats`,
   `submitReview`). This one reaches past the barrel into the BC's tables.
   The whole point of `libs/bc/study` owning `schema.ts` and exposing
   `cards.ts` / `reviews.ts` / `stats.ts` as the API is that other products
   -- reps, calibration, future audio surface -- read the same data through
   the same surface. Once one route runs its own SELECT, every next route
   has precedent to do the same; a year from now nobody can change `review`
   without grepping every app.
2. **No user scoping on the query.** The inline `WHERE` clause filters only
   on `cardId`. Today that's survivable because `getCard(params.id, user.id)`
   ran immediately before and 404s on mismatch, so an attacker can't reach
   this code path for a card they don't own. But the guarantee is three
   lines of code upstream, not in the query. A small refactor -- rewriting
   `load` in parallel or swapping in a `Promise.all` -- could accidentally
   drop the upstream guard and leak another user's review history. A BC
   function would be forced to take `(cardId, userId)` and bake the scope in.
3. **Duplicates the `CardRow`/`ReviewRow` shape pattern.** The route
   hand-picks columns into a custom inline shape instead of returning a
   typed, reusable `ReviewHistoryRow` that the BC could expose. When the
   calibration tracker wants the same recent-reviews view on its own UI, it
   has to repeat the SELECT from scratch.
4. **Tables are exported from the barrel specifically to enable ad-hoc
   queries like this.** `libs/bc/study/src/index.ts:8` exports `review`,
   `card`, `cardState`, `studySchema` -- which is the door this route walked
   through. Unless the intent is deliberate (and the barrel comment doesn't
   say so), these table exports should be dropped from the public barrel
   and kept internal; the BC functions expose everything the app layer
   needs.

**Fix.** Add `getRecentReviewsForCard(cardId: string, userId: string, limit?: number, db?: Db)` to `libs/bc/study/src/reviews.ts`, export it via the barrel, call it from the route. Return a dedicated `ReviewHistoryRow` interface. Then drop `card`, `cardState`, `review`, `studySchema` from the barrel (they're internal implementation) -- keep only the *row types* (`CardRow`, `ReviewRow`, ...) for consumers that need them in return signatures.

If one exception stays -- for example, migration scripts or smoke tests
(`scripts/smoke/study-bc.ts`) need the tables -- put them behind an explicit
`@ab/bc-study/schema` deep import, never on the barrel. That's already the
established pattern for `@ab/auth/schema` from `libs/bc/study/src/schema.ts`,
and the comment at `schema.ts:12-14` articulates exactly why: the deep path
is the escape hatch for tools that can't use the barrel. Adopt the same
discipline for the study BC.

Severity Major because the single leak is benign today but the habit it
seeds -- "just import the table" -- is the single fastest way to dissolve a
BC boundary across three or four products sharing one set of tables.

---

### [MAJOR] `libs/bc/study` is not actually a workspace package (root `workspaces` glob is `libs/*`, not `libs/bc/*`)

**Files:**
- `package.json:5` -- `"workspaces": ["apps/*", "libs/*"]`
- `libs/bc/study/package.json` -- declares `"name": "@ab/bc-study"`
- `node_modules/@ab/` -- does not exist; none of the `@ab/*` libs are actually linked as workspaces

The root `workspaces` glob matches one level (`libs/auth`, `libs/db`, etc.)
but `libs/bc/study` sits two levels deep and is never picked up by Bun.
Today nothing breaks because every `@ab/*` import path resolves through:

1. TypeScript `paths` in `tsconfig.json:23-39`
2. Vite/SvelteKit aliases in `apps/study/svelte.config.js:10-25`
3. Vitest aliases in `vitest.config.ts:7-16`

Each of the three alias tables lists every lib by hand, including
`@ab/bc-study`. The `package.json` in each lib is effectively decorative.

Three downstream consequences:

1. **No workspace link = no `bun install --workspace @ab/bc-study <pkg>`.**
   When `libs/bc/study` needs its own dependency (currently it piggybacks
   on the root `ts-fsrs`, `drizzle-orm`, `zod`), you can't add it at the
   lib level. Everything is forced into root `dependencies`. This is fine
   for shared infra (drizzle, zod) but wrong for `ts-fsrs`, which is a BC
   implementation detail.
2. **Every new lib means three alias-list edits in three files.** The next
   BC (`libs/bc/reps` per the design doc's future structure,
   `libs/bc/scenarios`, etc.) will need three simultaneous updates or
   imports silently fail in one tool and work in the others. The phase-1
   review already flagged a similar "three tables" concern; it's a
   structural issue, not a one-off.
3. **The `libs/bc/study/package.json` name (`@ab/bc-study`) doesn't match
   the CLAUDE.md documentation (`@ab/bc/study`).** CLAUDE.md's "Import
   Rules" section lists `@ab/bc/study`; actual code uses `@ab/bc-study`
   (hyphen, not slash). Either the docs lie or the imports do. A new
   contributor reading CLAUDE.md and typing `import ... from '@ab/bc/study'`
   will get an error that looks like a missing workspace but is actually a
   doc/alias mismatch.

**Fix.** One of two paths:

- **Path A (preferred):** change `package.json:5` to
  `"workspaces": ["apps/*", "libs/*", "libs/bc/*"]`. Bun handles nested
  globs. Run `bun install`. Verify `node_modules/@ab/bc-study` exists and
  points at `libs/bc/study`. Then the tsconfig/vite/vitest alias tables can
  stay (they still win over node_modules resolution in dev) but the CLI
  tools and scripts that lean on package resolution start working too.
- **Path B:** accept that `@ab/*` is alias-only and delete the `package.json`
  files in every `libs/*` dir. Fewer moving parts; cost is losing the
  ability to install lib-scoped dependencies.

Separately, reconcile CLAUDE.md's `@ab/bc/study` -> `@ab/bc-study` (or flip
the code to match the docs). Currently `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md`
also lists `libs/bc/study/` as a directory; the alias form is the ambiguity.

Severity Major because every new BC (reps, scenarios, calibration) rides on
this.

---

### [MINOR] `libs/constants/src/study.ts` placement inverts the usual dependency direction

**Files:** `libs/constants/src/study.ts` (144 lines); re-exported via `libs/constants/src/index.ts:40-66`.

Phase-1 architecture review already flagged this -- same finding. The
decision recorded in phase-0 was "follow the spec," and the spec puts
`DOMAINS`/`CARD_TYPES`/`CARD_STATES`/etc. at `libs/constants/src/study.ts`.
That's what's on disk. This note is to confirm the decision survives final
review given the full branch is in one place.

The mixing is real and the pressure will grow:

- `@ab/constants` currently holds: `PORTS`, `ROUTES`, `SCHEMAS`, `ROLES`,
  `HOSTS`, `ENV_VARS`, `LOG_LEVELS`, `DEV_*`, `BETTER_AUTH_*`,
  `MIN_PASSWORD_LENGTH`, `DB_*`, `SESSION_MAX_AGE_SECONDS`,
  `SHUTDOWN_TIMEOUT_MS` -- all genuinely cross-BC / cross-surface.
- Plus study vocabulary: `DOMAINS`, `CARD_TYPES`, `CARD_STATES`,
  `REVIEW_RATINGS`, `CONFIDENCE_LEVELS`, `CONTENT_SOURCES`,
  `CARD_STATUSES`, `MASTERY_STABILITY_DAYS`, `CONFIDENCE_SAMPLE_RATE`,
  `REVIEW_BATCH_SIZE`, `REVIEW_DEDUPE_WINDOW_MS`, `DOMAIN_LABELS`,
  `CARD_TYPE_LABELS`.

The BC reads its own vocabulary *from the shared leaf lib*
(`libs/bc/study/src/schema.ts:18-23` imports `CARD_STATE_VALUES` etc. from
`@ab/constants`). This is the backwards direction.

This doesn't block shipping. It becomes painful on the next two events:

- **When `libs/bc/reps/` lands.** It'll add `SCENARIO_STATES`,
  `REP_RATINGS`, `RECENCY_WEIGHTS` to `@ab/constants`. The "shared
  constants" lib starts being a directory of every BC's enums.
- **When ADR 011's knowledge graph ships.** Per the ADR, `DOMAINS` becomes
  a projection of the graph's domain taxonomy. Doing that inside the BC is
  trivial (`libs/bc/study/src/domains.ts` reads from graph at build time).
  Doing it inside `@ab/constants` forces the shared leaf to know about the
  graph, which is upside-down.

**Fix (can defer to pre-reps):**
- Move `DOMAINS`, `DOMAIN_LABELS`, `CARD_TYPES`, `CARD_TYPE_LABELS`,
  `CARD_STATES`, `REVIEW_RATINGS`, `CONFIDENCE_LEVELS`, `CONTENT_SOURCES`,
  `CARD_STATUSES`, `MASTERY_STABILITY_DAYS`, `CONFIDENCE_SAMPLE_RATE`,
  `REVIEW_BATCH_SIZE`, `REVIEW_DEDUPE_WINDOW_MS` to
  `libs/bc/study/src/constants.ts` and re-export via `@ab/bc-study`.
- Keep in `@ab/constants` only the genuinely cross-BC leaf: `SCHEMAS`,
  `PORTS`, `ROUTES`, `ROLES`, `HOSTS`, `ENV_VARS`, `DEV_*`,
  `BETTER_AUTH_*`, `MIN_PASSWORD_LENGTH`, `LOG_LEVELS`, `DB_*`,
  `SESSION_MAX_AGE_SECONDS`, `SHUTDOWN_TIMEOUT_MS`.

Routes import from `@ab/bc-study` instead of `@ab/constants` for study
vocabulary. `ROUTES` memory paths stay in `@ab/constants` -- they are
platform routing, not BC vocabulary.

If the decision remains "keep them in `@ab/constants` to simplify form
validation in routes," document the exception in `libs/constants/src/study.ts`
and in `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md` so the next BC
author knows where their enums belong.

---

### [MINOR] `escapeLikePattern` is duplicated between `@ab/db` and `libs/bc/study`

**Files:**
- `libs/db/src/escape.ts:5-7` -- exported as `escapeLikePattern` from `@ab/db`
- `libs/bc/study/src/cards.ts:67-69` -- private `escapeLikePattern` with the same body

The BC has its own local copy of the exact same function that lives one lib
up. Both are correct (escape `\`, `%`, `_`). The phase-0 and phase-2 reviews
treat them as separate concerns -- neither noticed they're duplicated.

**Fix.** Replace the local copy in `cards.ts` with
`import { escapeLikePattern } from '@ab/db'`. That's what the helper was
written for.

---

### [MINOR] `libs/bc/study/src/index.ts` barrel exposes internal Drizzle tables

**File:** `libs/bc/study/src/index.ts:8`

Same root cause as the Major finding above: the barrel currently exports
the raw tables:

```typescript
export { card, cardState, review, studySchema } from './schema';
```

This is the door the detail route walked through. A clean BC barrel exposes
only the *types* of rows (`CardRow`, `ReviewRow`, `CardStateRow`) and the
functions that operate on them. The tables themselves are schema
implementation -- they belong to `drizzle-kit` (via `drizzle.config.ts`'s
explicit path reference) and to internal BC code, not to the app layer.

**Fix.** After the `getRecentReviewsForCard` fix:

- Drop `card`, `cardState`, `review`, `studySchema` from
  `libs/bc/study/src/index.ts`.
- Keep `CardRow`, `ReviewRow`, `CardStateRow`, `NewCardRow`, `NewReviewRow`,
  `NewCardStateRow` (return types).
- If any script needs the tables, it deep-imports from
  `@ab/bc-study/schema`, mirroring the `@ab/auth/schema` pattern already
  used in `libs/bc/study/src/schema.ts:14`. The relative
  `libs/bc/study/src/schema.ts` import works for drizzle-kit today -- same
  path would work for scripts.

---

### [MINOR] Scripts use relative cross-lib imports (`../../libs/...`) instead of `@ab/*` aliases

**Files:**
- `scripts/db/seed-dev-users.ts:16,25,26`
- `scripts/smoke/study-bc.ts:14,23-26`

Both scripts import with relative paths:

```typescript
import { bauthUser } from '../../libs/auth/src/schema';
import { createCard, ... } from '../../libs/bc/study/src/index';
import { CARD_TYPES, ... } from '../../libs/constants/src/index';
import { CARD_STATUSES } from '../../libs/constants/src/study';
```

CLAUDE.md: "Always use `@ab/*` path aliases for cross-lib imports. Never
relative paths across lib boundaries."

`tsconfig.json` already lists `scripts/**/*.ts` in `include` and ships the
full `@ab/*` paths, so the alias form would work. This works today via Bun's
native TS runner, which follows tsconfig paths. But it's inconsistent with
the rule and with every app/lib file in the repo.

**Fix.** Rewrite both scripts to use the aliases:

```typescript
import { bauthUser } from '@ab/auth/schema';
import { createCard, ... } from '@ab/bc-study';
import { CARD_TYPES, CARD_STATUSES, ... } from '@ab/constants';
```

Extra benefit: `scripts/smoke/study-bc.ts:26` currently reaches past the
`@ab/constants` barrel to deep-import `CARD_STATUSES` from `./study` --
after the move in the previous finding, that import disappears entirely
(the constant either lives in `@ab/bc-study` or `@ab/constants` top-level).

---

### [MINOR] Study-specific `ROUTES` keys live in platform `@ab/constants`

**File:** `libs/constants/src/routes.ts:8-23`

`ROUTES` currently lumps together:

- Common routes: `HOME`, `LOGIN`, `LOGOUT`, `API_AUTH`.
- Study product routes: `MEMORY`, `MEMORY_REVIEW`, `MEMORY_NEW`,
  `MEMORY_BROWSE`, `MEMORY_CARD(id)`, `REPS`, `REPS_SESSION`,
  `REPS_BROWSE`, `REPS_NEW`, `CALIBRATION`.

With a single study app this is harmless, but the moment `apps/spatial/`
exists, it either:

- Adds its own `ROUTE_WALKTHROUGH`, `AIRPORT_CARD(id)`, etc. to the same
  `ROUTES` constant (`@ab/constants` grows into a directory of every app's
  routes), or
- Creates its own `ROUTES`, in which case we'd want a per-app split that
  doesn't exist yet.

**Fix (can defer until second surface app).** Split the `ROUTES` constant:

- `libs/constants/src/routes.ts` keeps `HOME`, `LOGIN`, `LOGOUT`,
  `API_AUTH`, and cross-surface routes shared by all apps (dashboard,
  admin).
- Per-app routes live with the app, e.g. `apps/study/src/lib/routes.ts`
  exports `STUDY_ROUTES`. Or -- if we want them in `libs/` for BC/server
  use -- put them in `libs/constants/src/study-routes.ts` and re-export via
  `@ab/bc-study` (routes belong to the surface more than the BC, but since
  BC URLs can't collide across surfaces today, either is fine).

Not urgent -- this only gets tangled once a second surface app ships. Worth
a note now so the next author doesn't just pile more product-specific keys
into the shared `ROUTES`.

---

### [MINOR] `@ab/bc-study` alias name doesn't match directory structure or CLAUDE.md docs

**Files:**
- `libs/bc/study/package.json` -- `"name": "@ab/bc-study"`
- `tsconfig.json:37-38` -- `"@ab/bc-study": [...]`
- `apps/study/svelte.config.js:24-25` -- `'@ab/bc-study': ...`
- `vitest.config.ts:15` -- `'@ab/bc-study': ...`
- `CLAUDE.md` -- documents `@ab/bc/study` in the "Import Rules" and "Path aliases" sections.

The code names the package `@ab/bc-study` (hyphen), the docs call it
`@ab/bc/study` (slash). Both are valid npm names. The inconsistency is
historical -- CLAUDE.md was written against the future `@ab/bc/*`
namespace convention; the implementation shipped hyphenated. Noted in
phase-0; flagging again at final because it's still unreconciled.

**Fix.** Pick one; update the other. Preference: `@ab/bc/study` (slash)
because (a) it matches the directory structure, (b) it parallels
`@ab/auth/schema` deep-import pattern, (c) CLAUDE.md is the contract for
future contributors. The change would be:

- Rename in `libs/bc/study/package.json`.
- Update `tsconfig.json`, `svelte.config.js`, `vitest.config.ts` alias
  entries.
- Update every `from '@ab/bc-study'` import (5 route files + 1 smoke
  script).

One commit. Blocks nothing. Pattern-rot risk if deferred too long.

---

### [MINOR] BC functions accept optional `db` -- pattern is right, but transaction composition isn't yet exercised

**Files:** every BC function in `libs/bc/study/src/`.

The design doc explicitly asked for `BC functions accept optional db: Db
arg (dep-injection for tx)`. Every function does:

```typescript
export async function createCard(input: ..., db: Db = defaultDb): Promise<CardRow> { ... }
```

Good. Works for single-function calls. But the test of this pattern is
*composing* two BC functions inside one caller tx -- for example, "create
card + immediately set status" or "submit review + invalidate calibration
summary." No caller does this yet. The pattern is in place; its stress
test is Phase 5+ (reps or calibration).

**Observation, not action.** When the first composing caller lands, check:

- `createCard` opens its own inner `db.transaction(...)`. If the caller
  passes a tx (`TxDb`), Drizzle's nested `.transaction()` becomes a
  `SAVEPOINT`, which is correct. Smoke script `scripts/smoke/study-bc.ts`
  passes `db` (not a tx) so never exercises this. Confirm with a test
  that nests two BC calls in one outer `db.transaction()` and verifies
  rollback works.
- Row-locking inside `submitReview` (`SELECT ... FOR UPDATE` on
  `card_state`) is correct under `READ COMMITTED`. If the outer caller
  uses `SERIALIZABLE`, the same lock is still correct but serialization
  failures become visible to the caller -- make sure error handling at
  the outer layer can retry.

Nothing to fix now; keeping on the radar for the next BC integration.

---

### [NIT] Per-app `$lib/server/{auth,cookies}.ts` are thin wrappers that will proliferate

**Files:**
- `apps/study/src/lib/server/auth.ts` -- 14 lines, wraps `createAuth` with
  `building`/`dev` awareness.
- `apps/study/src/lib/server/cookies.ts` -- 11 lines, wraps `forwardAuthCookies`
  + `clearSessionCookies` with `dev`.

Both exist because `@ab/auth` can't read `$app/environment` (SvelteKit
module) itself; the app has to. The wrappers are fine -- they're the
smallest reasonable SvelteKit glue. But every new surface app
(`apps/spatial/`, `apps/audio/`, ...) will need identical copies of these
14+11 lines.

**Options for later:**

- Accept the copy (14+11 lines isn't a lot, and the shape is stable).
- Export a SvelteKit-aware `createAppAuth()` helper from a new
  `libs/auth/src/sveltekit.ts`, so each app's `$lib/server/auth.ts` is:

  ```typescript
  import { createAppAuth } from '@ab/auth/sveltekit';
  export const auth = createAppAuth();
  ```

Path is fine either way. Flagging because "14-line copy-paste per app" is
the exact accumulation-pattern CLAUDE.md warns about with constants and
routes.

---

### [NIT] `drizzle.config.ts` schema list needs manual edits per BC

**File:** `drizzle.config.ts:6`

```typescript
schema: ['./libs/auth/src/schema.ts', './libs/bc/study/src/schema.ts'],
```

Every new BC adds one path here. Low cost, but an easy thing to forget.

**Option:** glob `./libs/**/schema.ts` at config time. drizzle-kit accepts
a glob pattern in `schema`. Two-line change:

```typescript
schema: './libs/**/schema.ts',
```

Tradeoff: glob picks up any lib with a `schema.ts`, including ones the BC
author didn't intend. Explicit list is clearer; just be aware every new BC
means editing this file.

Nit because the current list is two entries.

---

### [NIT] `tsconfig.json` `include` lists `libs/bc/*/src/**/*.ts` separately from `libs/*/src/**/*.ts`

**File:** `tsconfig.json:41`

```json
"include": [
    "libs/*/src/**/*.ts",
    "libs/bc/*/src/**/*.ts",
    ...
]
```

The second entry exists because `libs/*` only matches one level. Fine, but
similar to the workspaces-glob issue above -- the assumption that BCs live
in `libs/bc/*/src/` is duplicated across three places (tsconfig include,
alias list, drizzle config schema list). Any change to the BC path layout
(e.g. moving to `libs/bc/study-cards/`, or flattening `libs/bc/study/` ->
`libs/study/`) touches all three.

Observation only -- the current layout is stable.

---

### [NIT] `vitest.config.ts` alias list is a hand-maintained copy of `tsconfig.json` paths

**Files:** `vitest.config.ts:5-17` vs `tsconfig.json:22-39`.

Both tables list every `@ab/*` alias. Drift risk: add a new lib, update
tsconfig, forget vitest. Tests for the new lib silently fail with
"module not found" at the wrong layer.

**Option.** Use the `vite-tsconfig-paths` plugin in `vitest.config.ts` so
the aliases come from `tsconfig.json` automatically. Same approach would
work for `svelte.config.js` via a Vite plugin. Removes three hand-maintained
alias tables (tsconfig, vitest, svelte/vite) in favor of one (tsconfig).

Nit because drift hasn't bitten yet.

---

## Architectural checks -- explicitly requested in review scope

| # | Check                                                          | Verdict | Notes                                                                                         |
| - | -------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| 1 | Cross-lib imports via `@ab/*`                                  | mostly  | All app + lib code uses `@ab/*`. Scripts use `../../` (Minor).                                 |
| 2 | Dependency direction clean                                     | yes     | `constants -> utils -> db -> auth -> bc/study -> app`. Cycle-free.                             |
| 3 | App vs lib split correct                                       | mostly  | One route bypasses BC into raw tables (Major finding).                                         |
| 4 | BC functions accept optional `db: Db`                          | yes     | Every exported function has `db: Db = defaultDb` as the trailing arg.                          |
| 5 | BC barrel exports complete and scoped                          | mostly  | Complete -- but exposes raw tables (Minor). Fix with Major #1.                                 |
| 6 | `bauthUser` deep-imported from `@ab/auth/schema` with comment  | yes     | `libs/bc/study/src/schema.ts:12-14` has the comment. Pattern is exactly right.                 |
| 7 | `libs/bc/study/src/validation.ts` consumed by BC + routes      | yes     | BC (`cards.ts:27,74,142`, `reviews.ts`) and routes (`new/`, `[id]/`, `review/`) both use it.   |
| 8 | Study constants placement                                      | see MINOR | Decision was "follow spec." Unchanged after full branch review; will hurt at BC #2.           |
| 9 | Route file layout under `(app)/memory/*` consistent            | yes     | `+page.server.ts` + `+page.svelte` at each level. `/memory`, `/memory/review`, `/memory/new`, `/memory/browse`, `/memory/[id]`. |
| 10| `/memory/review` lives at `(app)/memory/review/`               | yes     | Correct.                                                                                      |
| 11| ADR 011 extensibility -- `source_type`/`source_ref`/`is_editable`, `node_id` placeholder | mostly | `source_type` + `source_ref` + `is_editable` are on `card`. `node_id` is not yet added -- the ADR explicitly says "not prematurely during steps 1-3," so this is correct. Extension is additive (backward-compat NULL column). No refactor needed. |
| 12| Per-app `$lib/server/{auth,cookies}.ts` pattern                | yes     | Thin wrappers exist. Will proliferate (Nit).                                                  |
| 13| Drizzle config schema list (manual registration per BC)        | yes     | `drizzle.config.ts:6` explicit list. Glob option noted in Nit.                                 |
| 14| Vitest config aliases match tsconfig paths                     | yes     | Every `@ab/*` present. Drift risk (Nit).                                                      |

---

## What the branch gets right

Worth saying explicitly so it's preserved when the next BC lands:

- **FSRS boundary is textbook.** `libs/bc/study/src/srs.ts` wraps `ts-fsrs`
  in an airboss-flavored API (`CardSchedulerState`, `ScheduleResult`,
  airboss `CardState` strings, `ReviewRating` constants). No runtime logic
  in the wrapper -- only type translation. The upstream can change and
  the BC keeps its shape. Tests (`srs.test.ts`) cover the scheduler's
  behavior directly; no ts-fsrs internals leak into tests.
- **Validation placement.** `libs/bc/study/src/validation.ts` exports Zod
  schemas used by both BC functions (defense-in-depth at the service
  boundary -- `cards.ts:74,142`) and route handlers (user-facing error
  messages -- `new/+page.server.ts:49`, `[id]/+page.server.ts:70`). The
  same schema normalises input once; both layers get the same guarantees.
- **Transaction discipline in `submitReview`.** The `SELECT ... FOR UPDATE`
  on `card_state` before the idempotency check, combined with the 5-second
  dedupe window and the `CardNotFoundError` path so the route can skip
  deleted cards mid-session, is carefully engineered. This is the
  high-risk function of the whole feature and it's the best-defended one.
- **CHECK constraints at the schema level.** Every enum column has a
  matching Postgres CHECK -- `card_type_check`, `card_source_type_check`,
  `card_status_check`, `review_rating_check`, `review_confidence_check`,
  `review_state_check`, `card_state_state_check`. If the app layer ever
  skips validation, the DB still refuses bad data. The generated SQL
  fragment (`inList()` at `schema.ts:41-44`) is a small manual step
  because Drizzle can't yet emit CHECK from typed enums -- but the
  pattern is sound and the fragment is well-commented.
- **`card_state.lastReviewedAt` denormalization.** The phase-2 review
  flagged this as Critical (missing `lastReview` meant FSRS lost
  `elapsed_days`); the fix was to denormalize the timestamp onto
  `card_state` with an explanatory comment at `schema.ts:124-127`. Now
  the scheduler gets real elapsed days on every review without an extra
  lookup. The denormalization is load-bearing; the comment will stop
  future readers from wondering why it exists.
- **Knowledge-graph forward-compat.** `source_type` + `source_ref` +
  `is_editable` on `card` covers the three integration paths ADR 011's
  "Content source model" calls out (courses, products, imports), plus
  personal cards as the default. `node_id` is deferred per ADR 011
  build-order step 4 ("not prematurely"). When the graph lands, adding a
  nullable `node_id` column + a `getNodeMastery` function to `stats.ts`
  is additive; no migration of existing card data required.
- **One BC, not three.** The structure under `libs/bc/study/src/` matches
  the design doc's "Sub-modules will grow: cards.ts, reviews.ts,
  scenarios.ts, calibration.ts, srs.ts" -- today there are four files
  (cards, reviews, srs, stats) plus schema/validation/index. Adding
  `scenarios.ts` and `calibration.ts` slots in without a lib-boundary
  change.

---

## What to do before the next product (reps / calibration) lands

Ordered by blocking-ness:

1. **Fix Major #1 (route bypass)** -- add `getRecentReviewsForCard`, drop
   raw tables from the barrel. Takes ~30 minutes. Blocks "what are the
   study BC's public seams?" for the next consumer.
2. **Decide on Major #2 (workspaces glob)** -- either fix the glob or
   reconcile the docs. Takes ~15 minutes. Blocks "how does a new BC
   author scaffold their lib?"
3. **Reconcile `@ab/bc-study` vs `@ab/bc/study` (Minor #7).** Takes
   ~10 minutes. Blocks CLAUDE.md from lying.
4. **Collapse `escapeLikePattern` duplication (Minor #3).** Takes
   ~2 minutes.
5. Everything else can wait until reps or calibration work begins.

The rest of the feature (Phases 1-4) is in good shape. Nothing critical.
The two Major findings are about avoiding habits that would corrode the
boundary layer as more products land -- easier to fix now than after two
or three route-layer leaks accumulate.

---

## Appendix A: file/line index for the findings

| Finding  | Files referenced                                                                     |
| -------- | ------------------------------------------------------------------------------------ |
| Major #1 | `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:1,10-12,32-47`; `libs/bc/study/src/index.ts:8` |
| Major #2 | `package.json:5`; `libs/bc/study/package.json`; `tsconfig.json:37-38`; `apps/study/svelte.config.js:24-25`; `vitest.config.ts:15`; `CLAUDE.md` Import Rules |
| Minor #1 | `libs/constants/src/study.ts`; `libs/constants/src/index.ts:40-66`; `libs/bc/study/src/schema.ts:18-23` |
| Minor #2 | `libs/db/src/escape.ts:5-7`; `libs/bc/study/src/cards.ts:67-69`                      |
| Minor #3 | `libs/bc/study/src/index.ts:8`                                                       |
| Minor #4 | `scripts/db/seed-dev-users.ts:16,25,26`; `scripts/smoke/study-bc.ts:14,23-26`        |
| Minor #5 | `libs/constants/src/routes.ts:8-23`                                                  |
| Minor #6 | `libs/bc/study/package.json`; `tsconfig.json:37-38`; `apps/study/svelte.config.js:24-25`; `vitest.config.ts:15`; CLAUDE.md Import Rules |
| Minor #7 | every `libs/bc/study/src/*.ts` BC function                                           |
| Nit #1   | `apps/study/src/lib/server/auth.ts`; `apps/study/src/lib/server/cookies.ts`          |
| Nit #2   | `drizzle.config.ts:6`                                                                |
| Nit #3   | `tsconfig.json:41`                                                                   |
| Nit #4   | `vitest.config.ts:5-17` vs `tsconfig.json:22-39`                                     |
