---
title: 'Design: ADR 026 implementation -- registry-canonical edition coherence'
product: platform
feature: adr-026-implementation
type: design
status: unread
review_status: done
---

# Design: ADR 026 implementation -- registry-canonical edition coherence

The implementation contract for [ADR 026](../../decisions/026-edition-coherence/decision.md). Three pieces: the resolver API, the browser/server split for `@ab/sources`, the seed-only-writer contract for `study.reference.edition`.

## Resolver API

ADR 026 §6 specifies four exports. They live at [libs/sources/src/registry/edition-resolver.ts](../../../libs/sources/src/registry/edition-resolver.ts) and are re-exported from a new [libs/sources/src/server.ts](../../../libs/sources/src/server.ts) barrel.

### Signatures

```typescript
import type { EditionRow } from '../db/schema.ts';
import type { SourceId } from '../types.ts';

/**
 * The current edition for a source -- the row with `retired_at IS NULL` and
 * highest `published_at`. Returns null when no current edition exists (every
 * row for the slug carries `retired_at`).
 *
 * Tiebreak: when two rows share `published_at`, the lex-greater `id` wins.
 * Matches `getCurrentEditionForSource` (existing in editions.ts:138).
 */
export async function getCurrentEdition(sourceId: SourceId): Promise<EditionRow | null>;

/**
 * The row for `(sourceId, editionLabel)`. Returns null when no row matches.
 * Used by the amendment-2026-05 resolver chain when a citation pins to an
 * older edition (e.g. a page-pinned AFH 3B citation): the resolver fetches
 * the labelled row to confirm the pin is valid.
 */
export async function getEditionByLabel(sourceId: SourceId, label: string): Promise<EditionRow | null>;

/**
 * `true` when the named edition exists and carries `retired_at`. `false` for
 * unknown labels OR for rows whose `retired_at IS NULL`. The "unknown returns
 * false" semantics matches the implicit "if I don't know about this row, I
 * have no evidence it's superseded" rule the BC consumers want.
 */
export async function isEditionSuperseded(sourceId: SourceId, label: string): Promise<boolean>;

/**
 * Every edition row for `sourceId`, oldest first. Returns `[]` when none exist.
 * Used by the regulations + library readers when they need the full chain
 * (e.g. the "history" view of a CFR Part across years).
 */
export async function listEditionsForSource(sourceId: SourceId): Promise<readonly EditionRow[]>;
```

### Implementation notes

- All four use Drizzle queries against `editionsTable` (the existing `sources_registry.editions` Drizzle handle in [libs/sources/src/db/schema.ts](../../../libs/sources/src/db/schema.ts)). The partial index `editions_source_current_idx WHERE retired_at IS NULL` covers `getCurrentEdition`'s hot path.
- `getCurrentEdition` is a thin wrapper around the existing `getCurrentEditionForSource` helper -- the new function name matches the ADR's specified surface; the existing implementation continues to be the impl. Either re-export the existing function under the new name OR rename in place; new name preferred for ADR alignment.
- The four helpers are async. All seven BC consumer + route handler call sites are already in async contexts; no caller refactor needed beyond the swap.
- The functions live in `libs/sources/src/registry/edition-resolver.ts`, NOT in `editions.ts`. `editions.ts` continues to own the in-memory cache + bootstrap path (`getEditionsMap`, `loadEditionsFromDb`, `warmEditionsCache`). The resolver file is the public surface for "what is the current edition?" reads.

### Why one resolver file, not five spread across per-corpus resolvers

ADR 026 §6 makes this load-bearing: "Without a single API, every consumer would re-implement the registry probe, which re-introduces the drift this ADR is closing." The per-corpus resolvers (`libs/sources/src/handbooks/resolver.ts`, `regs/resolver.ts`, etc.) keep doing what they do today -- they parse locators, return rendered content, dispatch to the indexed tier. The "is this superseded?" probe lives in one place, called by the per-corpus resolvers + by the BC consumers.

## Browser/server split for `@ab/sources`

`@ab/sources` is imported by client `.svelte` files (e.g. [apps/study/src/lib/components/RenderedLesson.svelte](../../../apps/study/src/lib/components/RenderedLesson.svelte)). It is also imported by 30+ server files. The current root barrel ([libs/sources/src/index.ts](../../../libs/sources/src/index.ts)) re-exports browser-safe helpers (`fromSerializable`, `substituteTokens`, `parseIdentifier`, etc.) and is browser-bundle-safe today.

The new resolver API touches `db` (postgres driver). Per the CLAUDE.md hard rule: any value re-exported from a browser-eligible barrel evaluates `db` at hydration time and crashes the dev server. The new helpers therefore live in a server-only entry point, NOT in the root barrel.

### The pattern

Mirror `@ab/bc-study/server` (the validated pattern for this exact problem):

```jsonc
// libs/sources/package.json
{
  "name": "@ab/sources",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./server": {
      "types": "./src/server.ts",
      "default": "./src/server.ts"
    },
    "./package.json": "./package.json"
  }
}
```

```typescript
// libs/sources/src/server.ts (new file)
// @browser-globals: server-only -- never imported by client .svelte
//
// Server-only barrel for `@ab/sources`. Every value re-exported here touches
// `db` (postgres driver) and cannot be evaluated in a browser bundle. Client
// surfaces import from `@ab/sources` (the root barrel) for browser-safe
// helpers; server surfaces import from `@ab/sources/server`.

export {
  getCurrentEdition,
  getEditionByLabel,
  isEditionSuperseded,
  listEditionsForSource,
} from './registry/edition-resolver.ts';

// Existing server-only helpers callers reach via deep file import today.
// Surface them here so future callers don't reach into `registry/editions.ts`
// directly.
export {
  getCurrentEditionForSource,
  getEditionsMapAsync,
  loadEditionsFromDb,
  warmEditionsCache,
} from './registry/editions.ts';
```

### What stays in the root barrel

Today's [libs/sources/src/index.ts](../../../libs/sources/src/index.ts) is unchanged by this WP. It continues to export browser-safe helpers (`fromSerializable`, `substituteTokens`, `parseIdentifier`, `urlForReference`, `airbossRef*` builders, `getCorpusResolver`, etc.). The side-effect imports of per-corpus resolvers stay; they don't reach `db` at module top-level (they register pure functions into the corpus map; `db` access happens only when those functions are called from a server context).

The one carefully-watched item: `getEditionsMap` (sync, in-memory Map read) stays callable from the root barrel because the per-corpus resolvers call it during locator parsing. It's pure read-only -- the cache is populated by `warmEditionsCache` (server-only, called from `apps/{app}/src/hooks.server.ts`) and consumed sync after that. No DB access happens at the call site. Today the per-corpus resolvers (`handbooks/resolver.ts:189`, `regs/resolver.ts`, etc.) deep-import it; that pattern is unchanged by this WP.

### Wiring into the browser-globals guard

[scripts/check-browser-globals.ts](../../../scripts/check-browser-globals.ts) walks every value re-export from runtime barrels and blocks runtime imports of `@ab/db/connection`, `@ab/bc-study/server`, etc. from any client-eligible file under `apps/*/src/**`. After this WP, `@ab/sources/server` joins that allowlist -- a `.svelte` file that imports from it fails the guard.

### Why not the cheap option

The "leave the new helpers in `editions.ts`, callers deep-import" alternative was considered and rejected. Reasons:

1. The CLAUDE.md rule is clear: server-only helpers go through a `/server` barrel; deep imports bypass the public API.
2. `@ab/sources` already has a quiet drift toward "deep file import for server-only" (callers reach into `editions.ts`, `bootstrap.ts`, `lifecycle.ts` directly). ADR 026 is the forcing function to fix that pattern, while we have one resolver API to migrate vs. the next 5 server-only additions.
3. Pattern consistency across `bc-study` and `sources` makes the codebase smaller -- one mental model for "where do server-only helpers live."

## Seed-only-writer contract for `study.reference.edition`

Per ADR 026 §3, `study.reference.edition` is a denormalized cache. The seed populates it from `sources_registry.editions.edition_label`. No other path writes the column. A `bun run check` guard enforces this at the lint layer.

### What the seed does

For each `study.reference` row the seed produces:

1. Look up the slug's current edition: `await getCurrentEdition(airbossRefForReference(row))` returns a row from the registry.
2. Read `editionLabel` from the registry row.
3. Verify the manifest's `edition` field (if any) matches the registry row's `editionLabel`. If not, abort the seed with a message naming both:

   ```text
   Seed error: manifest edition mismatch for `airboss-ref:handbooks/afh`
     manifest.json says: 8083-3D
     sources_registry.editions says: 8083-3C
     Update one or the other and re-run.
   ```

4. Write `study.reference.edition = registry.editionLabel`.

For superseded editions (rows where the registry has `retired_at` set): the seed continues to write the row with the registry's `editionLabel`, just as before. The dropped `study.reference.supersededById` column is not replaced by anything in `study.reference` -- the supersession state lives only in the registry.

### What the lint guard does

[scripts/lint/edition-cache-write-guard.ts](../../../scripts/lint/edition-cache-write-guard.ts) walks every `.ts` file in the repo, looks for any `.set({ ... edition: ... })` or `.values({ ... edition: ... })` call against a Drizzle query whose target is `reference` (study.reference). Allowed sites:

```text
libs/bc/study/src/seeders/**
scripts/db/seed-references-from-manifest.ts
scripts/db/seed-references.ts
scripts/db/seed-syllabi.ts
```

Anything else is a violation. The guard runs as part of `bun run check`; the orchestrator at [scripts/check.ts](../../../scripts/check.ts) wires it as a parallel step alongside the other lint scripts.

### Why this enforcement

The conservative-default label on `study.reference.edition` (ADR 026 §3) requires teeth -- otherwise the column drifts the moment someone writes "just this one update from a route handler." The guard makes the contract enforceable without dropping the column entirely.

## What stays unchanged

- The in-memory edition cache + generation counter (`_activeEditions`, `_editionsGeneration` in `editions.ts`). The new resolver functions read the same DB rows the cache mirrors, but they hit the DB directly -- they're called from request-handling code, not from per-corpus resolvers in tight loops. The cache is for sync-read paths; the resolver is for async-read paths.
- The per-corpus resolver registry pattern (`getCorpusResolver`, `ENUMERATED_CORPORA`).
- The `urlForReference` helper.
- Every `airboss-ref:` URI shape -- locators, parsers, validators.
- ADR 020's errata model -- the seed-only-writer contract applies to `edition`, NOT to errata sheets, which continue to flow through the `manifest.json -> handbooks/<doc>/<edition>/_errata/` pipeline.

## Rollback path

If a regression is found post-merge: the entire change is contained to one PR. `git revert <merge-sha>` undoes it cleanly. The schema rollback works because there's no migration history -- `0000_initial.sql` regenerates from the reverted schema.ts, the dropped columns reappear, callers compile again. No data loss because the registry continues to hold the supersession state regardless.

In practice: don't optimize for rollback. The change is small, well-tested, and the manual walkthrough catches the user-visible failure modes. Land it cleanly, fix forward if anything breaks.
