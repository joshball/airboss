---
title: Command palette Phase 2 -- patterns review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: patterns
status: pending
review_status: done
issues_found: 3
---

# Patterns review

Project pattern compliance (constants, routes, naming, conventions, DRY).

## Findings

### P1. (Major) Five helpers duplicated verbatim across 8 loaders

**Files:** `libs/help/src/loaders/{handbook-sections,cfr-sections,aim-sections,knowledge-nodes,cards,reps,plans,courses}.ts`

Each loader carries a local copy of:

- `escapePattern(s)` -- ilike pattern escape (identical body in every loader that uses ilike)
- `bucketFor(needle, ...)` -- 4-tier exact / prefix / substring scorer (slight variations on which fields are scored, but the same shape)
- `bodySnippet(body, needle)` -- 140-char windowed snippet with leading ellipsis (identical in handbook/cfr/aim/knowledge)
- `titleFromFront`/`snippetFromBack` -- 80- and 140-char one-line truncators (cards/reps re-implement the same thing)
- the local `Db` alias for `PgDatabase<PgQueryResultHKT, Record<string, never>>`

That's ~40 lines of duplicate code per loader. When the project decides to switch from ilike to FTS, or move to a Postgres-native string-distance ranker, every loader has to change in lockstep. Today the duplication is silent; tomorrow it is a refactor magnet.

**Fix:** extract to `libs/help/src/loaders/_shared.ts` (or `_loader-utils.ts`):

```ts
export function escapeIlikePattern(s: string): string { ... }
export function buildIlikePattern(needle: string): string { ... }
export function bucketByMatch(needle: string, ...fields: string[]): RankBucket { ... }
export function bodySnippet(body: string, needle: string, width = 140): string { ... }
export function truncateOneLine(text: string, max: number): string { ... }
export type LoaderDb = PgDatabase<PgQueryResultHKT, Record<string, never>>;
```

Then every loader calls the shared helpers. `bucketByMatch` accepts a variadic fields list so the per-loader nuances (front+back vs code+title vs slug+title) collapse to differing call sites, not differing implementations.

### P2. (Minor) `'14 CFR Part'` hardcoded string in aviation-refs subtitle

**File:** `libs/help/src/loaders/aviation-refs.ts` (line 106)

```ts
if (st === REFERENCE_SOURCE_TYPES.CFR) return '14 CFR Part';
```

Same Title 14 assumption as the CFR loader (see correctness C1). `LIBRARY_REGULATIONS_KIND_LABELS` in `libs/constants/src/study.ts` already has `'14 CFR' / '49 CFR' / 'AIM' / 'Advisory Circulars'`. Route through the constant once the title is discriminated.

### P3. (Nit) Subtitle strings carry display formatting inline

**Files:**

- `libs/help/src/loaders/aviation-refs.ts`: `'AIM'`, `'ACS'`, `'Pilot/Controller Glossary'`, `'Advisory Circular'`
- `libs/help/src/loaders/cards.ts`: `'Card - ${r.domain}'`
- `libs/help/src/loaders/plans.ts`: `'Plan - ${r.status}'`
- `libs/help/src/loaders/courses.ts`: `'Course - ${r.slug}'`
- `libs/help/src/loaders/knowledge-nodes.ts`: `'Knowledge - ${r.domain}'`
- `libs/help/src/loaders/reps.ts`: `'Rep - ...'`
- `libs/help/src/loaders/external-tools.ts`: `'Validated · External tool'`, `'Community · External tool'`

Each loader invents its own subtitle shape. The palette has no consistency principle. A single `subtitleFor(type, row)` switch in a shared helper would give the palette a uniform visual rhythm and let style decisions land in one place.

Not blocking for Phase 2; surface this for Phase 3 (visual variants) where the detail pane needs consistent rendering.
