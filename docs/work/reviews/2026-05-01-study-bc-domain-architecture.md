---
feature: study-bc-domain
category: architecture
date: 2026-05-01
branch: main
counts:
  critical: 1
  major: 0
  minor: 3
  nit: 1
status: unread
review_status: done
---

## Status as of 2026-05-04

| Severity | Count | Closed | Open |
| -------- | ----: | -----: | ---: |
| critical |     1 |      0 |    1 |
| major    |     0 |      0 |    0 |
| minor    |     3 |      0 |    3 |
| nit      |     1 |      0 |    1 |

### CRITICAL: Undeclared cross-BC dep on `@ab/bc-hangar` -- STILL OPEN

`libs/bc/study/package.json` still lists only `@ab/audit`, `@ab/auth`, `@ab/bc-sim`, `@ab/constants`, `@ab/db`, `@ab/sources`, `@ab/types`, `@ab/utils`. No `@ab/bc-hangar` entry. `libs/bc/study/src/citations/citations.ts:18` and `libs/bc/study/src/citations/search.ts:10` still `import { hangarReference } from '@ab/bc-hangar/schema'`. Workspace install resolves at runtime; metadata still hides the coupling. Trigger: when WP-CITATIONS-EXTRACT or any future cross-BC refactor touches `bc-study/citations`, declare the dep + add a curated `getHangarReferencesByIds(ids)` helper on `@ab/bc-hangar` and route the citation BC through it instead of the table object.

### MINOR: Deep-subpath imports rely on missing `exports` field -- STILL OPEN

`libs/db/package.json` and `libs/auth/package.json` still have no `exports` field. 27+ deep imports of `@ab/db/connection` + `@ab/auth/schema` keep working only because the resolution falls through. Trigger: bundle into a "package boundary hardening" WP alongside the bc-hangar dep declaration above; both fixes touch package.json `exports` discipline.

### MINOR: `@ab/bc-sim/persistence` deep-subpath -- STILL OPEN

`libs/bc/study/src/sim-bias.ts:16` still imports `getRecentSimWeakness`, `GetRecentSimWeaknessOptions`, `SimWeaknessSignal` from `@ab/bc-sim/persistence`. `libs/bc/sim/src/index.ts` does not re-export them. `bc-sim` `package.json` exposes the wildcard `./*` so the import works. Trigger: roll into the same package-boundary WP -- either re-export through the bc-sim barrel or replace `./*` wildcard with an explicit `./persistence` entry.

### MINOR: Citations polymorphic source schema enforced only by check + BC -- STILL OPEN

`libs/bc/study/src/citations/schema.ts` still has check constraints on `sourceType`/`targetType` enums but no per-type FKs; the BC layer is the write gate. Architectural design call already documented in the work package -- this is "tighten enforcement" not a bug. Trigger: ADR or follow-up WP if the citations BC ever exposes a write path that bypasses `verifySourceOwnership` / `verifyTargetExists`. Until then, current discipline holds.

### NIT: `engine-targeting.ts` adjacent to `engine.ts` -- STILL OPEN

`libs/bc/study/src/engine.ts` and `libs/bc/study/src/engine-targeting.ts` still co-located with the same prefix. No code-level note added pointing at ADR 014's purity boundary. Trigger: roll into any future engine refactor (e.g. when sim weakness or new candidate kinds land).

### Final verdict

All five findings still open. None are mechanical 1-3 line fixes; all require WP-level coordination (package metadata hardening + ADR follow-ups). `review_status` stays `done` because the audit is complete; `status` controlled by user.

## Summary

Reviewed `libs/bc/study/src/` end to end (full directory, ~70 modules including subpackages `citations/` and `seeders/`). The BC layering is largely sound: no app imports, no Svelte / SvelteKit framework imports, no raw SQL outside Drizzle index/check primitives, no `any`-leaks or non-null assertion abuse spotted in the source files, and the `runEngine` core in `engine.ts` complies with ADR 014 (pure, only `@ab/constants` + local types from `./schema`, no DB or framework deps; pool reads come through injected callbacks).

The `studySchema` Postgres namespace is correctly used by both `schema.ts` and `citations/schema.ts` (`citations/schema.ts` re-uses the sibling `studySchema` rather than re-declaring it -- consistent with the work-package note that `content_citations` lives in the study schema). Drizzle table objects, row types, and `studySchema` are all exported via the BC barrel (`index.ts`), and route handlers are explicitly steered toward BC functions in the export comment.

One critical finding: the citations submodule reaches into `@ab/bc-hangar/schema` to import `hangarReference`, but `@ab/bc-hangar` is not declared as a dependency in `libs/bc/study/package.json`. This is an undeclared cross-BC import and a hard violation of monorepo dependency hygiene -- it works today because `@ab/bc-hangar` happens to resolve through the workspace, but it is invisible to dependency analysis, package linting, and any future migration of the citations BC.

A handful of minor items round out the review: the `@ab/bc-sim/persistence` deep import path used by `sim-bias.ts` is a deep subpath rather than a curated BC barrel re-export, and `@ab/db/connection` / `@ab/auth/schema` deep imports work only because those packages omit an `exports` field (so anything resolves) -- which is itself a smell. The `engine-targeting.ts` filename is close enough to `engine.ts` that the purity boundary between them (engine = pure, engine-targeting = DB-backed read order) is easy to misread.

## Issues

### CRITICAL: Undeclared cross-BC dependency on `@ab/bc-hangar`

File: `libs/bc/study/src/citations/citations.ts:18`, `libs/bc/study/src/citations/search.ts:10`, plus `libs/bc/study/package.json`

Problem: `citations/citations.ts` and `citations/search.ts` both import `hangarReference` from `@ab/bc-hangar/schema`, and the citations BC writes/reads `content_citation` rows whose target type can resolve to a `hangar.reference` row (handbook / AC / regulation references live in the hangar BC). However, `libs/bc/study/package.json`'s `dependencies` block lists only `@ab/auth`, `@ab/bc-sim`, `@ab/constants`, `@ab/db`, `@ab/sources`, `@ab/types`, `@ab/utils`. There is no `@ab/bc-hangar` entry. The import resolves at runtime only because Bun walks the workspace, but the dependency is invisible to package metadata, audit tooling, and any "extract this BC" or "re-host citations" refactor.

This is also a cross-BC import that creates a hard coupling between bc-study and bc-hangar at module-graph level, not just a contract-level dep. The work-package note in `citations/index.ts` justifies folding citations into bc-study because the rows live in the study schema, but the runtime read still crosses into the hangar table. That coupling needs to be declared and intentional, not implicit.

Rule: monorepo packages must declare every `@ab/*` they import (both for dependency-graph correctness and to make cross-BC coupling reviewable). Cross-BC imports go through a curated access tier (the BC's barrel `index.ts`), not through deep `/schema` subpaths.

Fix:

1. Add `"@ab/bc-hangar": "workspace:*"` to `libs/bc/study/package.json` `dependencies`.
2. Decide whether the citations BC genuinely needs the hangar table object directly. If yes, expose `hangarReference` (or a narrower read helper) from `@ab/bc-hangar`'s `index.ts` and switch the imports to the barrel. If the underlying read is "given a hangar reference id, hydrate it for a citation target", that read belongs behind a function on the hangar BC (e.g. `getHangarReferencesByIds(ids)`) and the study BC consumes that, never the table object.
3. Re-run `bun run check` and confirm the workspace install graph picks up the new dep.

### MINOR: Deep subpath imports rely on packages omitting `exports`

File: `libs/bc/study/src/*` (27 sites importing `@ab/db/connection`), plus `schema.ts:18`, `citations/schema.ts:19` importing `@ab/auth/schema`

Problem: 27 modules in `bc-study` deep-import `@ab/db/connection` and two modules deep-import `@ab/auth/schema`. Neither `libs/db/package.json` nor `libs/auth/package.json` declares an `exports` field, so any subpath resolves -- which is the only reason these imports work. The `@ab/db` index file (`libs/db/src/index.ts`) is explicit that `connection` is intentionally NOT re-exported from the barrel because the live `postgres` pool has top-level side effects (opens the pool, registers SIGTERM handlers, calls `requireEnv('DATABASE_URL')`) that break SvelteKit client bundles. So the deep import is intentional design, but it relies on the absence of an `exports` map rather than declaring `./connection` as an explicit subpath.

Rule: cross-lib imports should go through curated exports. Subpath access should be declared, not accidental.

Fix: add an `exports` field to `libs/db/package.json` and `libs/auth/package.json` declaring exactly which subpaths are public. For db: `"."`, `"./connection"`, `"./package.json"`. For auth: `"."`, `"./schema"`, plus whichever other subpaths are intentionally public (audit current call sites). This codifies the "connection is a server-only opt-in" rule at the package boundary instead of leaving it to convention.

### MINOR: `@ab/bc-sim/persistence` deep subpath instead of barrel re-export

File: `libs/bc/study/src/sim-bias.ts:16`

Problem: `sim-bias.ts` imports `getRecentSimWeakness`, `GetRecentSimWeaknessOptions`, and `SimWeaknessSignal` directly from `@ab/bc-sim/persistence`. `@ab/bc-sim`'s `package.json` does export the wildcard `"./*"`, so this resolves, and the import comment above it (`// rule -- import them from '@ab/bc-sim/persistence'`) suggests this is the intentional access shape. However, the bc-sim BC barrel (`libs/bc/sim/src/index.ts`) does not re-export these symbols, so the only way to consume them is through the deep path. That makes the cross-BC contract invisible from the bc-sim index -- a future change to `persistence.ts` (rename, signature change, internal refactor) won't surface as a barrel-level breaking change.

Rule: cross-BC imports go through the consuming BC's barrel so the surface is curated and grep-able from `index.ts`.

Fix: re-export `getRecentSimWeakness`, `GetRecentSimWeaknessOptions`, and `SimWeaknessSignal` from `libs/bc/sim/src/index.ts` and switch `sim-bias.ts` to `import { ... } from '@ab/bc-sim'`. If the intent is to keep these as a separate "persistence" access tier (sim -> study integration only), declare an explicit `"./persistence"` entry in the bc-sim `exports` map (replacing the wildcard), and document the tier in the bc-sim `index.ts` header.

### MINOR: Citations' polymorphic source schema is only enforced by check constraint, not FK

File: `libs/bc/study/src/citations/schema.ts:30-90`, `libs/bc/study/src/citations/citations.ts:1-16`

Problem: The architecture-level question, not a code bug. The polymorphic citation table (`content_citations`) carries `(sourceType, sourceId)` and `(targetType, targetId)` pairs without per-type FKs. The header comment in `citations.ts` is candid that referential integrity is "soft" and the BC layer is the write gate. This is an intentional design call documented in the work package, but it does push validation responsibility from the schema into the BC. The risk surface: any future code path that bypasses the BC functions (a script, a seed, a future "let me batch insert citations" admin tool) can silently violate the invariant, because the DB will accept any string in `source_id` / `target_id`. The check constraints validate `sourceType` / `targetType` enums but not row existence.

Rule: the BC is the write gate, but the gate must be enforced by export discipline -- if the table object is exported, callers can `db.insert(contentCitation).values(...)` directly. The `index.ts` already comments "route handlers should prefer BC functions and never issue raw db.insert/select on these tables", but that's documentation, not enforcement.

Fix: keep the polymorphic design (the WP justifies it), but tighten enforcement:

1. Add a runtime guard in the BC that the citations seed/import scripts must call (`assertCitationSourceExists`, `assertCitationTargetExists`) and document it in the schema header.
2. Consider whether `contentCitation` needs to be exported from the BC barrel at all. Today it is -- per the policy in `index.ts:403-405` -- but the polymorphic semantics mean direct table access is more dangerous than for normal tables. If only the seed code needs the table object, narrow the export to a `@ab/bc-study/schema` deep path (paired with an explicit `exports` map) and keep the BC barrel as the sole public surface for production code.

### NIT: `engine-targeting.ts` adjacent to `engine.ts` blurs the purity contract

File: `libs/bc/study/src/engine-targeting.ts`, `libs/bc/study/src/engine.ts`

Problem: `engine.ts` is the pure scoring core (no DB, ADR 014 governs its dials). `engine-targeting.ts` is a DB-backed read-order resolver that produces an `EngineTargeting` value the orchestrator hands into `runEngine`. The two files are conceptually different layers -- one is pure, one issues SQL -- but the file naming implies they're peers in the same module. A reader skimming the directory could reasonably assume `engine-targeting` is part of the engine's pure surface and inadvertently add DB calls into `engine.ts` itself, breaking the ADR 014 boundary.

Rule: file names should reflect layer / purity. The pure engine and its DB-backed adapter shouldn't share a prefix that suggests they're the same module.

Fix: consider renaming `engine-targeting.ts` to `targeting.ts` or `goal-targeting.ts` (the file's own header calls it "the bridge between learner intent and the session engine's filter contract", which reads as targeting, not engine). At minimum, add a one-line note at the top of `engine.ts` ("for the DB-backed targeting resolver, see `targeting.ts`; this file is pure per ADR 014") so the boundary is documented in code, not just in the ADR.
