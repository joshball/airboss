# Magic Strings + Numbers Audit

Read-only scan of `apps/study/src`, `libs/bc/**`, `libs/ui/src`, `libs/help/src`. Scope and rule source: `CLAUDE.md` "Critical Rules" (no magic strings, no magic numbers; all literal values in `libs/constants/`; all routes through `ROUTES`).

## Summary

- **0** inline route strings in `href=` / `goto(` / `redirect(`. `ROUTES` usage is clean.
- **7** hardcoded route strings in help `documents:` metadata fields (should reference `ROUTES`).
- **~30+** magic numbers with domain meaning (predominantly `24 * 60 * 60 * 1000` MS_PER_DAY in BC code; also FSRS rating literals `1`/`2` in `engine.ts`; engine scoring weights `0.6`, `0.4`, `0.3`, `0.9`, etc.; cookie `YEAR_SECONDS`).
- **~40** enum-like literals bypassing existing constants (mostly `'card' | 'rep' | 'node_start'` bypassing `SESSION_ITEM_KINDS`; `'today'` bypassing `SESSION_SKIP_KINDS`; `'relearning'` bypassing `CARD_STATES`; `'core' | 'supporting' | 'elective'` bypassing `RELEVANCE_PRIORITIES`; `'skeleton' | 'started' | 'complete'` bypassing `NODE_LIFECYCLES`; `'pass' | 'fail' | 'insufficient_data' | 'not_applicable'` bypassing `NODE_MASTERY_GATES`).
- **0** hex colors in scanned files.
- **9** raw `z-index` values across `libs/ui/**`, `libs/help/**`, `apps/study/src/routes/(app)/+layout.svelte`. No shared token layer yet.

## Severity tiers

### Critical (breaks project rules, existing constants available)

All of these have their replacement constant already exported from `@ab/constants`. These are pure literal-to-constant swaps.

#### `'card' | 'rep' | 'node_start'` -> `SESSION_ITEM_KINDS.{CARD,REP,NODE_START}`

`libs/bc/study/src/engine.ts`:

- Lines 354, 356 -- narrowing `scored.kind === 'card'` and returning `{ kind: 'card', ... }` in `toSessionItem`
- Lines 358, 360 -- same for `'rep'`
- Lines 362, 363 -- same for `'node_start'`
- Lines 372-374 -- `identityOf` switch: `'card'`, `'rep'`, `'node_start'`
- Lines 378-380 -- `identityKeyOfScored` same three
- Line 419 -- `kind: 'card'` in continuePool (card branch)
- Line 431 -- `kind: 'rep'` in continuePool (rep branch)
- Line 446 -- `kind: 'card'` in strengthenPool
- Line 460 -- `kind: 'rep'` in strengthenPool
- Line 478 -- `kind: 'node_start'` in expandPool
- Line 493 -- `kind: 'card'` in diversifyPool
- Line 506 -- `kind: 'rep'` in diversifyPool
- Line 523 -- `kind: 'node_start'` in diversifyPool

`apps/study/src/routes/(app)/session/start/+page.svelte`:

- Line 63 -- `KIND_DEFINITIONS` object keyed `card | rep | node_start` (string literal keys)
- Lines 69, 75 -- `KIND_LABELS` and `KIND_HELP` same shape
- Line 81 -- function param type `kind: 'card' | 'rep' | 'node_start'` should be `SessionItemKind`
- Lines 348, 350 -- `item.kind === 'node_start'`, `item.kind === 'card'` in template
- Lines 786, 791 -- CSS selectors `[data-kind='node_start']`, `[data-kind='rep']` (CSS is harder to avoid, but the attribute writer should emit the constant)

`libs/bc/study/src/sessions.ts`:

- Lines 508-510 -- `item.kind === 'card' | 'rep' | 'node_start'` in fan-out loop
- Lines 680-682 -- same three in insert row shape

`libs/bc/study/src/test-support.ts`:

- Line 98 -- `kind: 'rep'` (test fixture; flag for consistency but test fixtures are lower priority than production)

#### `'today' | 'topic' | 'permanent'` -> `SESSION_SKIP_KINDS.{TODAY,TOPIC,PERMANENT}`

`apps/study/src/routes/(app)/sessions/[id]/+page.server.ts`:

- Line 257 -- `skipKind: 'today'` in the CardNotFoundError recovery branch
- Line 332 -- `skipKind: 'today'` in the ScenarioNotFoundError recovery branch
- Line 389 -- `form.get('skipKind') ?? 'today'` default

#### `'relearning'` card state -> `CARD_STATES.RELEARNING`

`libs/bc/study/src/engine.ts`:

- Line 265 -- `if (card.state === 'relearning') base += 0.9;`
- Line 311 -- `if (card.state === 'relearning') return SESSION_REASON_CODES.STRENGTHEN_RELEARNING;`
- Line 721 -- `if (card.state === 'relearning') return 'Relearning state';`

#### `'core' | 'supporting' | 'elective'` -> `RELEVANCE_PRIORITIES.{CORE,SUPPORTING,ELECTIVE}`

`libs/bc/study/src/engine.ts`:

- Line 82 -- interface field type `priority: 'core' | 'supporting' | 'elective'` -> should be `RelevancePriority`
- Line 285 -- triple-branch ternary using literals
- Line 324 -- `if (node.priority === 'core')`

`libs/bc/study/src/sessions.ts`:

- Lines 400-404 -- `priority: 'core' | 'supporting' | 'elective' = ... ? 'core' : ? 'supporting' : 'elective'` narrowing ladder

#### `'pass' | 'fail' | 'insufficient_data' | 'not_applicable'` -> `NODE_MASTERY_GATES.{PASS,FAIL,INSUFFICIENT_DATA,NOT_APPLICABLE}`

`apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte`:

- Lines 55-62 -- `gateLabel` switch. Should import `NODE_MASTERY_GATES` and a `NODE_MASTERY_GATE_LABELS` map (label map does **not** currently exist in `libs/constants/src/study.ts`; adding it is the fix so the switch collapses to a lookup).

#### `'skeleton' | 'started' | 'complete'` -> `NodeLifecycle` / `NODE_LIFECYCLES`

`libs/bc/study/src/knowledge.ts`:

- Line 441 -- `lifecycle: 'skeleton' | 'started' | 'complete';` in `KnowledgeNodeListRow`. Type is exported from `@ab/constants`; use `NodeLifecycle` directly.

#### FSRS rating literals `1 | 2` -> `REVIEW_RATINGS.{AGAIN,HARD}`

`libs/bc/study/src/engine.ts`:

- Lines 266-268 -- `card.lastRating === 1 ... base += 0.6; // Again`, `=== 2 ... base += 0.3; // Hard`
- Line 312 -- `if (card.lastRating === 1 || card.lastRating === 2) return SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN`
- Lines 722-723 -- `if (card.lastRating === 1) return 'You rated Again recently'; if (card.lastRating === 2) return ...`

#### `'mixed'` default session mode -> `SESSION_MODES.MIXED`

`apps/study/src/routes/(app)/plans/[id]/+page.server.ts`:

- Lines 56, 78 -- `form.get('defaultMode') ?? 'mixed'`, `coerceEnum(..., 'mixed')`

`apps/study/src/routes/(app)/plans/new/+page.server.ts`:

- Lines 37, 70 -- same pattern

`apps/study/src/routes/(app)/plans/new/+page.svelte`:

- Line 38 -- `$state<SessionMode>('mixed')`

#### Help `documents:` paths -> `ROUTES.*`

`apps/study/src/lib/help/content/*.ts`:

- `session-start.ts:95` -- `documents: '/session/start'` -> `ROUTES.SESSION_START`
- `memory-review.ts:30` -- `documents: '/memory/review'` -> `ROUTES.MEMORY_REVIEW`
- `dashboard.ts:23` -- `documents: '/dashboard'` -> `ROUTES.DASHBOARD`
- `reps-session.ts:23` -- `documents: '/session/start'` -> `ROUTES.SESSION_START`
- `knowledge-graph.ts:23` -- `documents: '/knowledge'` -> `ROUTES.KNOWLEDGE`
- `calibration.ts:20` -- `documents: '/calibration'` -> `ROUTES.CALIBRATION`

(`libs/help/src/validation.test.ts:99` also has `'/calibration'` -- skip per audit scope, it's a test fixture.)

#### `TABS = { ACTIVE: 'active', ARCHIVED: 'archived' }` -> reuse `PLAN_STATUSES`

`apps/study/src/routes/(app)/plans/+page.svelte`:

- Lines 25-31 -- locally redefines the two-state tab as a const object. Plan tabs and plan statuses are the same enum in practice; import `PLAN_STATUSES.ACTIVE` / `PLAN_STATUSES.ARCHIVED` and type `PlanTab = Extract<PlanStatus, 'active' | 'archived'>`.

### Major (project rule violation, needs a new constant or a shared helper)

#### MS_PER_DAY etc. not yet in `libs/constants/`

`libs/constants/src/` has `OVERDUE_GRACE_MS`, `REVIEW_DEDUPE_WINDOW_MS`, `RESUME_WINDOW_MS` -- all built out of the same `2 * 60 * 60 * 1000` pattern inline. There is **no** shared `MS_PER_DAY` / `MS_PER_HOUR` / `MS_PER_MINUTE` constant. Every duration in the BC layer re-derives it:

30 occurrences of `24 * 60 * 60 * 1000`:

- `libs/bc/study/src/scenarios.ts:582`
- `libs/bc/study/src/sessions.ts:229, 247, 435, 466, 1036, 1068, 1208`
- `libs/bc/study/src/dashboard.ts:245, 286, 304, 336, 362, 402`
- `libs/bc/study/src/stats.ts:69, 81`
- `libs/bc/study/src/calibration.ts:336, 341, 432, 435`
- `libs/bc/study/src/engine.ts:248` -- `7 * 24 * 60 * 60 * 1000`
- `libs/help/src/validation.ts:96` -- `365 * 24 * 60 * 60 * 1000` as `STALE_REVIEW_MS` (file-local constant, should move to shared)
- `apps/study/src/routes/appearance/+server.ts:5` -- `YEAR_SECONDS = 60 * 60 * 24 * 365` (file-local constant; move to shared)

Recommended: add to `libs/constants/src/time.ts` (new file):

```typescript
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;
export const MS_PER_YEAR = 365 * MS_PER_DAY;
export const SECONDS_PER_DAY = 24 * 60 * 60;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
```

#### Engine scoring weights are bare literals

`libs/bc/study/src/engine.ts` contains ~20 literal scoring coefficients (0.9, 0.6, 0.4, 0.3, 0.2, 0.1, 1.0, 0.95 etc.) distributed across `scoreContinueCard`, `scoreContinueRep`, `scoreStrengthenCard`, `scoreStrengthenRep`, `scoreExpandNode`, and `diversifyFrequencyScore`. Lines: 246, 249, 255, 258, 259, 265, 267, 268, 269, 270, 275, 276, 277, 285, 286, 287, 522, 538, 729.

The thresholds (0.6 rep-accuracy floor, 2 overdue ratio) are domain-meaningful cut-offs. The weights (0.9, 0.6, 0.4, etc.) are tuning dials.

Recommended: introduce `ENGINE_SCORING` namespaced object in `libs/constants/src/study.ts` (or a new `libs/constants/src/engine.ts`):

```typescript
export const ENGINE_SCORING = {
  CONTINUE: { LAST_SESSION_DOMAIN_WEIGHT: 1.0, PRIOR_DOMAIN_WEIGHT: 0.5, DOMAIN_WEIGHT_SHARE: 0.6, DUE_URGENCY_SHARE: 0.4, RECENT_MISS_BONUS: 0.2 },
  STRENGTHEN: { RELEARNING: 0.9, RATED_AGAIN: 0.6, RATED_HARD: 0.3, OVERDUE: 0.4, OVERCONFIDENCE_FACTOR: 0.3, REP_LOW_ACCURACY: 0.6, REP_RECENT_MISS: 0.4 },
  EXPAND: { PRIORITY_CORE: 1.0, PRIORITY_SUPPORTING: 0.6, PRIORITY_ELECTIVE: 0.2, FOCUS_MATCH: 0.4, BLOOM_MATCH: 0.2 },
  DIVERSIFY: { DEEP_DEPTH_BONUS: 0.1, CROSS_DOMAIN_APPLY_BONUS: 0.25 },
  REP_LOW_ACCURACY_THRESHOLD: 0.6,
  OVERDUE_RATIO_THRESHOLD: 2,
} as const;
```

(Sequencing: this needs ADR sign-off before the port because these numbers have test coverage. Could also be left as-is and flagged for a follow-up PR with test-regression checking.)

### Minor (consider normalizing)

#### z-index ladder

Raw `z-index` values live across several components with no shared layer:

- `libs/ui/src/components/Table.svelte:45` -- 1 (sticky header)
- `libs/ui/src/components/Dialog.svelte:116` -- 100 (modal)
- `libs/ui/src/components/NavIndicator.svelte:29` -- 1000 (nav indicator)
- `libs/ui/src/components/InfoTip.svelte:266` -- 50 (popover)
- `apps/study/src/routes/(app)/+layout.svelte:245` -- 100 (sticky header)
- `apps/study/src/routes/(app)/+layout.svelte:351` -- 50 (sidebar)
- `apps/study/src/routes/(app)/+layout.svelte:434` -- 50 (menu)
- `apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte:130` -- 1
- `libs/help/src/ui/HelpSearchPalette.svelte:212` -- 200 (command palette)

No clear stacking contract. InfoTip (50) < Dialog (100) < HelpSearchPalette (200) < NavIndicator (1000) -- but NavIndicator is *below* a dialog visually, yet its z-index is the highest. That's latent.

Recommended: add a token layer in `libs/themes/src/tokens.ts` (or a constants stack like `Z_INDEX = { BASE, STICKY, DROPDOWN, MODAL, POPOVER, TOAST, TOP } as const`). Migrate all call sites. Parks the ordering invariant in one place.

#### `ratingLabels` literal-keyed in `/memory/review`

`apps/study/src/routes/(app)/memory/review/+page.svelte:63-68` -- the labels `'Again' | 'Hard' | 'Good' | 'Easy'` and the keyboard keys `'1' | '2' | '3' | '4'` are a candidate for a shared `REVIEW_RATING_LABELS` in `libs/constants/src/study.ts`. The constants file has `REVIEW_RATINGS` (values) but no labels map. Rating buttons also appear elsewhere (session runner) -- a shared label map avoids drift.

#### `SLICE_HELP_SECTION` in session-start uses slice-value literals

`apps/study/src/routes/(app)/session/start/+page.svelte:56-61` -- values `'continue' | 'strengthen' | 'expand' | 'diversify'` are help-page fragment IDs that happen to equal the slice enum values. This is correct by convention but fragile: if anyone renames a slice, help links silently break. Consider deriving from `SESSION_SLICES` values directly (it's already the same string) and adding an inline comment asserting the coupling.

#### `coerceEnum` default literal

`apps/study/src/routes/(app)/plans/**` uses `coerceEnum<SessionMode>(raw, SESSION_MODE_VALUES as SessionMode[], 'mixed')`. The 3rd arg is a default. A `DEFAULT_SESSION_MODE = SESSION_MODES.MIXED` exported from study.ts would centralise the "mixed is the default" choice so future product decisions (switch to `continue` as default) don't require sweep.

## Existing constants misused / under-used

(Flagging once per user instructions; low priority.)

- `domainLabel` helper exists in `libs/constants/src/study.ts` but `apps/study/src/routes/(app)/reps/[id]/+page.svelte:22`, `reps/browse/+page.svelte:97`, `session/start/+page.svelte:128`, `memory/review/+page.svelte:70-72` each re-implement the `(DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug)` pattern. The docstring on `domainLabel` explicitly calls this out as "reviewers flagged 20+ duplicates" -- the helper exists, but migration didn't happen. Minor: single-line swap.

## Recommended fix plan

Staged, lowest-risk-first. Each phase is a separate PR; each finishes green on `bun run check`.

### Phase 1 -- help `documents` -> ROUTES (smallest, pure sweep)

One PR, six files under `apps/study/src/lib/help/content/`. Import `ROUTES` from `@ab/constants`, replace literal. Zero semantic change. Validation in `libs/help/src/validation.ts` checks these strings; verify the validator accepts the route constants.

### Phase 2 -- enum-literal cleanup (mostly engine.ts + sessions.ts + session-start)

Group by file, each a commit:

1. `libs/bc/study/src/engine.ts` -- swap all `'card' | 'rep' | 'node_start'` -> `SESSION_ITEM_KINDS.*`; `'relearning'` -> `CARD_STATES.RELEARNING`; rating literals `1 | 2` -> `REVIEW_RATINGS.AGAIN | REVIEW_RATINGS.HARD`; priority literals -> `RELEVANCE_PRIORITIES.*`.
2. `libs/bc/study/src/sessions.ts` -- item-kind + priority narrowing ladder (lines 400-404, 508-510, 680-682).
3. `libs/bc/study/src/knowledge.ts:441` -- `lifecycle` union type -> `NodeLifecycle`.
4. `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts` -- `'today'` -> `SESSION_SKIP_KINDS.TODAY` at lines 257, 332, 389.
5. `apps/study/src/routes/(app)/session/start/+page.svelte` -- keyed records to `SESSION_ITEM_KINDS.*`; `kind: 'card' | 'rep' | 'node_start'` function-arg type -> `SessionItemKind`.
6. `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte` -- add `NODE_MASTERY_GATE_LABELS` map in `libs/constants/src/study.ts`, then collapse the `gateLabel` switch to a lookup.
7. `apps/study/src/routes/(app)/plans/**/*.{svelte,server.ts}` -- `'mixed'` default -> `DEFAULT_SESSION_MODE` (add this constant first).
8. `apps/study/src/routes/(app)/plans/+page.svelte` -- replace local `TABS` object with re-use of `PLAN_STATUSES`.

Each file stands alone; a fixer agent can run them in parallel.

### Phase 3 -- MS / time constants

Single PR:

1. Add `libs/constants/src/time.ts` with `MS_PER_*` / `SECONDS_PER_*` constants.
2. Export from `libs/constants/src/index.ts`.
3. Sweep the 30+ occurrences: `libs/bc/study/src/{scenarios,sessions,dashboard,stats,calibration,engine}.ts`, `libs/help/src/validation.ts`, `apps/study/src/routes/appearance/+server.ts`.
4. Remove file-local `YEAR_SECONDS` and `STALE_REVIEW_MS` in favour of the shared constants (or keep the semantic name as `STALE_REVIEW_MS = 1 * MS_PER_YEAR`).

### Phase 4 -- engine scoring weights (needs ADR sign-off)

The numbers have test coverage in `libs/bc/study/src/engine.test.ts`; moving them into a `ENGINE_SCORING` constant must not change any computed score. Author a small ADR (or a work-package design doc) justifying the naming scheme, then do the sweep. Deferred behind Phase 1-3 because the tuning invariant is subtler than a literal rename.

### Phase 5 -- z-index token layer

Separate PR after Phase 4 (touches `libs/themes/**` and most UI components):

1. Add `Z_INDEX` to themes tokens (or to `libs/constants/src/ui.ts` if we prefer a non-CSS constant).
2. Migrate the 9 call sites across `libs/ui/src/components/{Table,Dialog,NavIndicator,InfoTip}.svelte`, `libs/help/src/ui/HelpSearchPalette.svelte`, `apps/study/src/routes/(app)/+layout.svelte`, `apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte`.
3. Fix the NavIndicator (1000) inversion against Dialog (100) as part of the migration.

### Phase 6 -- domainLabel sweep

One-line replacements across 4 files; pure cosmetic. Do last, as a cleanup commit alongside whichever phase touches those files.

## Files the fixer should touch, grouped

- **Phase 1 (help routes):** `apps/study/src/lib/help/content/{session-start,memory-review,dashboard,reps-session,knowledge-graph,calibration}.ts`
- **Phase 2a (BC):** `libs/bc/study/src/{engine,sessions,knowledge}.ts`
- **Phase 2b (routes/components):** `apps/study/src/routes/(app)/{session/start/+page.svelte, sessions/[id]/+page.server.ts, knowledge/[slug]/+page.svelte, plans/+page.svelte, plans/new/+page.{svelte,server.ts}, plans/[id]/+page.server.ts}`
- **Phase 2c (constants additions):** `libs/constants/src/study.ts` -- add `NODE_MASTERY_GATE_LABELS`, `REVIEW_RATING_LABELS`, `DEFAULT_SESSION_MODE`.
- **Phase 3 (time):** new `libs/constants/src/time.ts` + sweep per above.
- **Phase 4 (engine scoring):** new `libs/constants/src/engine.ts` + `libs/bc/study/src/engine.ts`.
- **Phase 5 (z-index):** `libs/themes/src/tokens.ts` or `libs/constants/src/ui.ts` + all 9 z-index sites.
- **Phase 6 (domainLabel sweep):** `apps/study/src/routes/(app)/{reps/[id]/+page.svelte, reps/browse/+page.svelte, session/start/+page.svelte, memory/review/+page.svelte}`.
