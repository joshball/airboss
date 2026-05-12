---
title: Command palette Phase 2 -- architecture review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: architecture
status: pending
review_status: done
issues_found: 3
---

# Architecture review

BC boundaries, dependency direction, lib vs app logic, module organization.

## Findings

### A1. (Major) Filter mode dispatch missing -- `library:mine` chip does not narrow

**Files:** `libs/help/src/search.ts` (`searchGrouped`), `libs/help/src/query-parser.ts` (BARE_TOKEN_FACETS), `libs/help/src/ui/HelpSearchPalette.svelte`

The query parser correctly synthesizes `library:mine` from bare `mine`. `FilterChips.svelte` renders the chip. But `searchGrouped` does not branch on the filter at all -- it always calls every loader. The result is that the `mine` chip is decorative; the user sees FAA + Airboss + help + external rows mixed in with the My Stuff column.

The spec's "Mode contract" diagram (`PALETTE_MODE_ELIGIBLE`) already encodes which result types a mode renders. The chip story should map the same way.

**Fix:** in `searchGrouped` (or a helper above it), inspect `parsed.filters` for `library:mine` / `library:aviation` / `library:help` / `library:both` and pass a `mode`-equivalent filter down through the loader fan-out. Loaders that are excluded by the filter return `[]` without hitting the DB.

This is one of the two big architecture seams the WP defined; Phase 4 builds on it.

### A2. (Minor) `searchGrouped` and `search` (legacy) coexist with no deprecation marker

**File:** `libs/help/src/search.ts` (lines 82-91 vs 329-451)

The legacy `search()` (returns `{aviation, help}`) sits next to `searchGrouped()` (returns `GroupedResults`). The spec's tasks.md 2b says "Keep the old facade as a deprecated alias for one release cycle; remove call sites in same PR." The current PR does NOT mark `search()` as deprecated -- no `@deprecated` JSDoc, no eslint rule pointing at it, no comment in the source warning new callers off.

The only known consumer (`HelpSearchPalette.svelte`) is migrated, but the export is still public via `@ab/help`.

**Fix:** either:

1. Add `@deprecated -- use searchGrouped() instead. Removal target: next palette PR.` JSDoc on `search()`.
2. Drop `search` from `index.ts` re-exports if no internal consumer remains. The legacy two-bucket return type is still in `schema/help-registry.ts` and may have other consumers (`helpRegistry.search` uses it under the hood) -- but the orchestrator function is replaceable.

Pick (1) for this PR; (2) for the next palette PR.

### A3. (Minor) `searchGrouped` imports mid-file -- imports section split across the file

**File:** `libs/help/src/search.ts` (line 296)

`import { expandQuery } from '@ab/aviation';` and 5 sibling imports sit at line 296 in the middle of the file, after the legacy `search()` exports and before the Phase 2 `searchGrouped()` block. JavaScript hoists imports so the runtime is correct, but Biome and most reviewers flag mid-file `import` as a smell -- it suggests "two files glued together with a section divider," which is what happened (the new facade was tacked onto the existing file).

**Fix:** hoist all imports to the top of the file. Group: external (`@sveltejs/kit`, `drizzle-orm`), then `@ab/*` (constants, aviation, db, bc-study), then relative (`./query-parser`, `./registry`, `./schema/*`, `./loaders/*`, `./search-core`).

This is a one-PR mechanical cleanup -- it does not change behavior, and it makes the file easier to read.

## Out of scope (verified clean)

- `@ab/help/server` vs `@ab/help` split is correct. The runtime barrel re-exports only browser-safe code; every DB-touching loader lives in the `/server` barrel; `searchGrouped` (browser-safe) imports only the in-process loaders.
- `browser-globals` lint passes; no `@ab/db/connection` or `postgres` reach the client bundle.
- Dependency direction: `apps/*/+server.ts` -> `@ab/help/server` -> `@ab/db` -> Postgres. Clean.
- `@ab/bc-study` and `@ab/audit` were correctly added as deps to `apps/sim` (the sim app's `+server.ts` indirectly pulls them via the `@ab/help/server` barrel).
