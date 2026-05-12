---
title: Command palette Phase 2 -- performance review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: perf
status: pending
review_status: done
issues_found: 4
---

# Performance review

## Findings

### Pf1. (Major) Eight parallel ilike scans on every keystroke -- including `content_md`

**File:** `libs/help/src/loaders/all.ts`

`loadPaletteInjected` runs eight loaders in parallel via `Promise.all`. Five of them (`handbook-sections`, `cfr-sections`, `aim-sections`, `knowledge-nodes`, and partly `courses`) include `ilike(... contentMd, '%${needle}%')`, which forces a full scan over every body row. On a moderately seeded DB this can be hundreds of MB of `content_md` per loader. Even with the 150ms debounce, a fast typist firing `w`, `we`, `wea`, `weat`, `weath`, `weathe`, `weather` produces seven full-scan fan-outs.

The spec calls out: "Non-goals: Server-side FTS. Phase 2 is in-memory only; if any query needs >50ms to rank we revisit." But the in-memory commitment applies to the aviation registry; the DB-backed loaders absolutely are server-side and are unprotected.

**Fix options (pick one for Phase 2; ratchet harder later):**

1. Add a Postgres trigram index (`CREATE INDEX ... USING gin (contentMd gin_trgm_ops)`) and switch ilike to a trigram-similarity threshold. Drizzle supports raw SQL for the schema portion.
2. Skip `contentMd` on needles shorter than 3 characters. A 1-char ilike against body is the worst possible case (matches everything).
3. Move the per-loader queries through Postgres FTS (`tsvector` column on `reference_section`, `to_tsquery` matching). FTS columns exist elsewhere in the project; check if `reference_section.fts` is already populated.

Minimum acceptable fix for Phase 2: option (2) (`needle.length < 3 -> match title + code only`). Cheap, removes the worst case, and matches the comment in `handbook-sections.ts` that says "handbook sections are too numerous to enumerate without a filter."

### Pf2. (Minor) `loadAllSections` query duplication -- handbook + CFR + AIM ilike on the same table

**Files:** `libs/help/src/loaders/{handbook,cfr,aim}-sections.ts`

All three loaders run essentially the same query against `study.reference_section`, differing only on `reference.kind`. Three round-trips, three planner runs, three result sets. A single query with `where reference.kind IN (handbook, cfr, aim)` + grouping in TS would halve the database load and remove a round-trip.

**Fix:** consolidate into one loader (`loadReferenceSections`) that returns rows tagged by `kind`, then assign `SearchResultType` and route href downstream. The cluster code already keys on a parent code -- this consolidation makes that bond easier (see correctness C2).

### Pf3. (Minor) `loadAviationRefs` runs even when `mine.*` filter is active

**File:** `libs/help/src/search.ts` (line 341) + `libs/help/src/loaders/aviation-refs.ts`

A query `mine card` produces `filters: [library:mine]`, free text `card`. `searchGrouped` still calls every in-process loader (`loadAviationRefs`, `loadHelpPages`, `loadExternalTools`). The aviation hits will rank against `'card'` and surface a bunch of unrelated FAA docs in FAA Resources -- noise the chip-scoped query says the user did not want.

**Fix:** when `library:mine` is the active filter, skip the FAA + help + external loaders. Use the chip story the spec calls for (the parser already has it; the runtime ignores it). See architecture A1.

### Pf4. (Nit) Cluster computation re-walks the FAA column on every search

**File:** `libs/help/src/search.ts` `buildClusters`

`buildClusters` constructs a Map of every handbook root + iterates every chapter row on every keystroke. Today the FAA column has at most a few dozen rows (the aviation registry caps at the LOADER_LIMIT of 50) so this is invisible. Not worth fixing in Phase 2.

Flag for Phase 3: when the detail pane lands and cluster expansion is more expensive (collapsed clusters need a +N count + children list), revisit.
