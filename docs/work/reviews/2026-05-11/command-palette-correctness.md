---
title: Command palette Phase 2 -- correctness review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: correctness
status: pending
review_status: done
issues_found: 5
---

# Correctness review

## Summary

Five correctness findings. Two are concrete bugs the user can hit today; three are robustness gaps the test plan does not exercise.

## Findings

### C1. (Major) CFR loader hardcodes Title 14 -- breaks Title 49 results

**File:** `libs/help/src/loaders/cfr-sections.ts` (lines 19, 29, 94, 97)

The loader filters by `reference.kind = REFERENCE_KINDS.CFR`, which captures BOTH 14 CFR and 49 CFR (`REFERENCE_KINDS.CFR` is a single value). It then unconditionally:

- titles every row `14 CFR §${code}`
- routes through `LIBRARY_REGULATIONS_KINDS.CFR_14` (`14-cfr`)

`regulations/cfr-49/` is real data (seeded as Title 49 references via `libs/bc/study/src/seeders/cfr.ts`, which builds `documentSlug` as `${title}cfr${partKey}` -- e.g. `49cfr175`). When any 49 CFR section is in the DB and the user types its needle, the result is mislabeled "14 CFR §..." and points at a 14 CFR route that doesn't host the section.

**Fix:** discriminate the title CFR by parsing the leading numeric segment off `documentSlug` (the seeder convention: `14cfr91`, `49cfr175`), or carry a `cfrTitle` column on `reference` if one exists. Map to `LIBRARY_REGULATIONS_KINDS.CFR_14` vs `CFR_49` accordingly; format title as `14 CFR §code` / `49 CFR §code`.

The `db-loaders.test.ts` test for CFR seeds `documentSlug: 'palette-cfr-...'`, which does not start with `14` or `49`, and asserts only `title.toContain('§')`. The bug is masked by the test fixture; a positive Title 49 test row would have surfaced it.

### C2. (Major) FAA Resources clustering never fires -- handbook / CFR root ids do not match chapter parentDocCode

**File:** `libs/help/src/search.ts` (`buildClusters`, lines 406-427)

`buildClusters` indexes handbook / CFR root rows by `row.id` and looks up children by `row.parentDocCode`. They must equal for a cluster to form.

- Aviation registry handbook root ids in `libs/aviation/src/references/faa-docs.ts` look like `doc-faah808325c`, `doc-faah808316b` (Phase 1 contract).
- Handbook chapter rows from `loaders/handbook-sections.ts` set `parentDocCode: r.documentSlug`, and `documentSlug` from the handbook seeder is the short slug (`phak`, `iph`, `ifh`, ...) per `handbooks/*/manifest.json`.

So `parentDocCode = 'phak'` and root `id = 'doc-faah808325c'` -- the map miss is total. Same shape on CFR: aviation registry id `doc-cfr-14-91` vs `parentDocCode = '14cfr91'`. No cluster will ever render in production.

**Fix:** pick one canonical key for the cluster bond. Cleanest: map both shapes to the same canonical code on the way out of each loader. Options:

1. Convert chapter `parentDocCode` to the registry id (`'phak'` -> `'doc-faah808325c'`) via a lookup against the aviation registry.
2. Convert handbook root `id` to the doc slug shape and store it on the registry row.
3. Add an explicit `clusterKey: string` field to `SearchResult` and have both loaders populate it.

(1) keeps the registry id as the canonical reference. (3) is the lowest-blast-radius mechanical change.

Until this is fixed, the "clusters" feature in the spec is dead code. The `clusters` field in `GroupedResults` will always be `[]` against real data.

### C3. (Minor) External tools surface 7 rows on filter-only queries

**File:** `libs/help/src/loaders/external-tools.ts` (line 16) + `libs/help/src/search.ts` (line 336)

`searchGrouped` early-exits only when free text AND filters AND injected are all empty. Typing `mine` alone yields `freeText = ''`, `filters = [{library: mine}]`. The early exit is skipped; loaders run with `parsed.freeText = ''`. `findExternalTools('')` returns all 7 tools. They all get `rankBucket = 4` and render unfiltered in the External Tools column on a `mine`-scoped query.

**Fix:** in `loadExternalTools`, return `[]` when free text is empty, mirroring the other loaders' "empty needle returns []" contract.

### C4. (Minor) `loadPaletteInjected` no error guard around `Promise.all`

**File:** `libs/help/src/loaders/all.ts` (line 32)

The file header says any loader that throws should propagate, "the endpoint should decide how to degrade (the canonical pattern is `try { ... } catch { return [] }`)". The endpoint at `handlePaletteSearch` does NOT wrap the call. So a transient DB error in any one of the 8 loaders surfaces to the client as a 500 and blanks the palette.

**Fix:** wrap the inner await in a try/catch inside `handlePaletteSearch` and return `{ results: [] }` with a logged warning, OR (better) make each loader self-defending: a `Promise.allSettled` in `loadPaletteInjected` returning only fulfilled slices.

`Promise.allSettled` is the better pattern -- a single loader failure shouldn't blank handbook + CFR + AIM + knowledge + cards + reps + plans + courses.

### C5. (Nit) `loadReps` magic rating numbers + label mismatch

**File:** `libs/help/src/loaders/reps.ts` (lines 92-104)

```ts
function formatRating(rating: number): string {
  switch (rating) {
    case 1: return 'Again';
    case 2: return 'Hard';
    case 3: return 'Good';
    case 4: return 'Easy';
    default: return `Rating ${rating}`;
  }
}
```

Two issues:

1. Bare numerics 1-4 (project rule: "No magic strings/numbers. Use `libs/constants/`"). `REVIEW_RATINGS` exists in `libs/constants/src/study.ts`.
2. Labels disagree with the project: `REVIEW_RATING_LABELS` in the same file uses `'Wrong' / 'Hard' / 'Right' / 'Easy'` (a deliberate departure from FSRS naming -- see the comment "decision: `Wrong / Hard / Right / Easy` (rather than FSRS's `Again / Hard / Good / Easy`)"). The palette using `'Again' / 'Good'` would surface the FSRS names on the My Stuff column while every other surface shows the project names.

**Fix:** import `REVIEW_RATING_LABELS` from `@ab/constants` and look up. Drop the local `formatRating`.

## Out of scope (not findings)

- Per-app boost via host surface tag: every `+server.ts` currently passes `APP_SURFACES.GLOBAL` (study/sim) or `LIBRARY` (flightbag) or `HANGAR` (hangar). Loaders `void` the host today. Per-app boost lands in Phase 4. The pieces are wired enough that they can be extended; nothing to fix.
