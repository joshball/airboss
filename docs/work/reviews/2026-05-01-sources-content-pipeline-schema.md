---
feature: sources-content-pipeline
category: schema
date: 2026-05-01
branch: main
issues_found: 14
critical: 1
major: 6
minor: 5
nit: 2
---

## Summary

The cache-tier (`scripts/sources/download/manifest.ts`) + YAML config (`scripts/sources/config/`) story is in good shape -- ADR 021 + ADR 022 are faithfully encoded as TS interfaces, validated through Zod, and exercised by atomic writes. The `@ab/sources` registry (Phase 2) ships the static identity table + lifecycle state machine + edition map per ADR 019 §2.1/§2.4 with sound types and IDs via `createId()`.

The biggest schema-quality gaps are at the in-repo derivative tier: there is **no Zod schema for the AC, ACS, AIM, regs/CFR, or chapter-aware handbook derivative manifests** (only the legacy whole-doc PHAK/AFH/AvWX shape). The committed `handbookManifestSchema` doesn't carry `schema_version` or the `errata[]` extension that the on-disk manifests already use, so any malformed derivative ships through. `promotion_batches` and `EDITIONS` are in-memory `Map`s with no Postgres backing, and `lifecycle.ts` lets the same `SourceId` exist in both `SOURCES[id].lifecycle` and the runtime overlay, which is a quiet divergence vector. Two ADR 019 §2.1 fields are missing from the production registry shape (`canonical_short` indexability, `superseded_by` FK semantics) and the legacy `libs/aviation/src/sources/registry.ts` is a parallel, non-`airboss-ref:` registry that nobody has retired.

## Issues

### CRITICAL: Derivative manifest Zod schema does not match what is on disk (no `schema_version`, no `errata[]`, no chapter-aware fields)

- **File**: `libs/bc/study/src/handbook-validation.ts` (`handbookManifestSchema`)
- **What's on disk**: every in-repo handbook manifest (`handbooks/phak/FAA-H-8083-25C/manifest.json`, `handbooks/afh/FAA-H-8083-3C/manifest.json`, ...) ships `errata[]` arrays with `errata_note_path` entries. ADR 020 mandates this. ADR 021 §"Manifest schema" and ADR 022 §"Manifest schema extension" require `schema_version`. None of these fields are in `handbookManifestSchema`.
- **Problem**: `scripts/db/check-manifests.ts` and `scripts/db/seed-handbooks.ts` validate against this Zod schema before touching the DB. A malformed `errata[]` entry, a missing `schema_version`, or any of the chapter-aware fields ADR 022 added pass through Zod silently and surface as DB-shape errors at insert time (or worse, silent drift). The committed manifests pass only because Zod is set to strip unknown keys (default).
- **Rule**: ADR 021 §"Manifest schema" requires `schema_version` on every manifest. ADR 020 §"Manifest extension" requires `errata[]`. Both are load-bearing for idempotent re-ingest.
- **Fix**: Add `schema_version: z.number().int().positive()` to `handbookManifestSchema`. Add `errata: z.array(handbookManifestErrataSchema).optional()` matching the on-disk shape (`source_filename`, `published_at`, per-section entries). Remove the legacy `kind` discriminator at the top level (it always equals `'handbook'` for the manifests this schema validates) or constrain it to `z.literal('handbook')`. Run `bunx vitest libs/bc/study/src/handbook-validation` against fixtures from each shipped handbook to lock in the contract.

### MAJOR: No Zod schemas for AC, ACS, AIM, or CFR derivative manifests

- **Files**: `ac/<doc>/<rev>/manifest.json`, `acs/<slug>/manifest.json`, `aim/<edition>/manifest.json`, `regulations/cfr-<title>/<edition>/manifest.json`, `regulations/cfr-<title>/<edition>/sections.json`
- **Problem**: `scripts/db/check-manifests.ts` only walks `handbooks/`. There is no equivalent validator for AC, ACS, AIM, or regs derivatives. The TS that reads them (`libs/sources/src/ac/ingest.ts`, `libs/sources/src/acs/ingest.ts`, `libs/sources/src/aim/source-ingest.ts`, `libs/sources/src/regs/derivative-writer.ts`) hand-rolls `JSON.parse(...) as Foo` casts. ADR 021 says these are first-class corpora; ADR 019 §2.5 needs them stable as snapshot inputs.
- **Rule**: Project rule "no `any`, no magic strings, all literal values typed." Untyped JSON parse is `any` in disguise.
- **Fix**: Author Zod schemas next to each corpus's ingest module: `acManifestSchema`, `acsManifestSchema`, `aimManifestSchema`, `cfrManifestSchema`, `cfrSectionsSchema`. Add a single `bun run sources verify-manifests` CLI that walks every corpus + asserts `schema.safeParse(...)`. Wire into `bun run check`.

### MAJOR: `promotion_batches` lives in an in-memory `Map`, no Postgres backing

- **File**: `libs/sources/src/registry/lifecycle.ts:84` (`const BATCHES: Map<string, PromotionBatch> = new Map();`)
- **Problem**: ADR 019 §2.4 explicitly names a `promotion_batches` table that records `reviewer_id`, `promotion_date`, `scope`, `inputSource`, with audit-trail semantics ("the original `promotion_batches` record is preserved for audit; a new record marks the de-promotion event"). Phase 2 ships the in-memory implementation with the comment "Persistence to Postgres is a future WP." The audit trail is the load-bearing claim of the lifecycle machine; without persistence, every process restart wipes it. There are no tests for survival across restart -- because there can't be.
- **Rule**: ADR 019 §2.4 ("the audit trail (`promotion_batches`) preserves every promotion + de-promotion event") + global rule "zero tolerance for known issues; a stub is a known issue."
- **Fix**: Land a `sources` (or `aviation`) Postgres namespace per ADR 004's "BC-mediated, namespaces are the isolation unit" pattern. Drizzle table: `sources.promotion_batch` with `id text` (`prefix_ULID` via `createId('batch')` -- already done in `recordPromotion`), `corpus`, `reviewer_id` (FK to `identity.bauthUser.id`), `promotion_date timestamptz default now()`, `scope text[]`, `input_source text`, `state text` CHECK in (`'promoted'`, `'de-promoted'`), `from_lifecycle` + `to_lifecycle` (CHECK against `SourceLifecycle` enum), `previous_batch_id` self-FK with `on delete set null`. Add `(corpus, promotion_date)` index for the audit log. Add a `sources.entry_lifecycle_overlay` table to persist the `ENTRY_LIFECYCLES` map (`SourceId` PK, `lifecycle text NOT NULL CHECK`).

### MAJOR: `EDITIONS` map is in-memory and never populated

- **File**: `libs/sources/src/registry/editions.ts:22` (`export const EDITIONS: ReadonlyMap<SourceId, readonly Edition[]> = new Map();`)
- **Problem**: ADR 019 §2.1 specifies `last_amended_date` as **per-section** on `SourceEntry` and notes that `editions: Edition[]` was moved to the indexed tier. The current implementation puts the indexed-tier in a runtime `Map` that ships empty and has no persistence path, no FK to `SOURCES`, no schema-version, no batch ingest entrypoint. `getEditionDistance`, `walkAliases`, and `getEditionLifecycle` all silently return `null`/`[]` because `EDITIONS` is empty -- which means **validator rule 3 ("Pinned edition exists in registry") will quietly never fire** once Phase 3 (CFR ingestion) lands real entries unless the persistence path lands first.
- **Rule**: ADR 019 §1.5 row 3 (ERROR severity); ADR 019 §2.5 (renderer must batch-resolve via `getEditions`); ADR 019 §6.1 (alias chains require `Edition.aliases`).
- **Fix**: Add Drizzle `sources.entry_edition` (`source_id text NOT NULL references sources.entry on delete cascade`, `edition_id text NOT NULL`, `published_date date NOT NULL`, `source_url text NOT NULL`, `aliases jsonb NOT NULL default '[]'`, PRIMARY KEY (`source_id`, `edition_id`), `(source_id, published_date) index` for chronological walks). Replace the in-memory map with a thin reader-cache backed by this table, populated by Phase 3+ ingest runs. While the table is empty Phase 2 still ships, but the contract is durable.

### MAJOR: Lifecycle overlay can drift from `SOURCES[id].lifecycle`

- **File**: `libs/sources/src/registry/lifecycle.ts:92-97` + `libs/sources/src/registry/index.ts:35-42`
- **Problem**: `getEntryLifecycle(id)` reads from `ENTRY_LIFECYCLES` overlay first, falling back to `SOURCES[id].lifecycle`. `productionRegistry.getEntry` materializes a fresh `SourceEntry` with the overlay applied. There is no invariant that says "if `id` exists in `ENTRY_LIFECYCLES`, the underlying `SOURCES[id].lifecycle` value is the original/seed value and the overlay is the truth." Two callers can disagree on which is canonical depending on whether they go through `getEntry` (overlay-aware) or read `SOURCES[id]` directly (overlay-blind). The static table is a frozen `Object.freeze({})` so direct reads are stable today, but the moment Phase 3+ adds entries, this becomes a subtle bug surface.
- **Rule**: ADR 019 §2.1 ("`SourceEntry.lifecycle`") -- the field IS the lifecycle; there should be exactly one source of truth.
- **Fix**: Either (a) drop `SOURCES[id].lifecycle` and store lifecycle exclusively in the overlay/persisted table, or (b) document that `SOURCES[id].lifecycle` is initial-state-only and add a lint that rejects direct reads of that field outside `lifecycle.ts`. Once `entry_lifecycle_overlay` is persisted (per the previous finding), make `getEntryLifecycle` the only reader.

### MAJOR: `superseded_by` / `supersedes` are unenforced -- no FK semantics, no chain-cycle guard

- **File**: ADR 019 §2.1 `SourceEntry` + `libs/sources/src/registry/query.ts` `walkSupersessionChain`
- **Problem**: `SourceEntry.supersedes` and `superseded_by` are declared `SourceId` (a branded string). In TS the registry has no constraint that these point to entries that exist; in Postgres there's no table yet so no FK enforces it either. ADR 019 §6.2 says "single-link; chains via traversal" and `walkSupersessionChain` traverses by following `superseded_by`. Phase 2 has no cycle guard; an `A.superseded_by = B`, `B.superseded_by = A` pair would loop until stack overflow.
- **Rule**: Drizzle/relational best-practice: every cross-row pointer needs an FK. Plus general loop-safety on graph walks.
- **Fix**: When the `sources.entry` table lands, add `superseded_by_id text references sources.entry on delete set null` and `supersedes_id text references sources.entry on delete set null`. In the query module, add a visited-set guard in `walkSupersessionChain` -- detect loops and emit a runtime error with the offending IDs (this is a registry author bug, not a user error).

### MAJOR: `regulations/cfr-<title>/<edition>/sections.json` lacks `canonical_short` index + `last_amended_date` validation

- **File**: `libs/sources/src/regs/derivative-writer.ts:63-76` (`SectionsJsonRecord` + `SectionEntry`)
- **Problem**: The schema is correct per ADR 018 §"Scale-tier exception" -- `body_path` + `body_sha256` per section, gitignored bodies. But `last_amended_date` is typed as `string` with no format validation (must be ISO date per ADR 019 §2.1). `canonical_short` is the column ADR 019 §2.3's `findEntriesByCanonicalShort` will scan -- with thousands of CFR sections per title, building that index on every render call (no DB) is O(n). For Phase 4 renderer this is fine; for the snapshot consumer (Python RAG, Lambda), a flat scan over 6328 entries (per the live `cfr-14/2026-04-22/manifest.json`) is the cost they pay.
- **Rule**: ADR 019 §2.3 lists `findEntriesByCanonicalShort` as a query-API entry point; sub-O(n) lookups need a real index.
- **Fix**: When `sources.entry` lands, add `canonical_short` as a column with a non-unique btree index (multiple corpora can share `§91.103` shape -- §91.103 in title 14 vs §91.103 hypothetical in some other corpus). Validate `last_amended_date` at write-time in `derivative-writer.ts` with `z.string().date()` to make malformed dates a build-time error.

### MINOR: Zod loader for handbook YAMLs uses `.passthrough()` -- silently accepts typos in ingest knobs

- **File**: `scripts/sources/config/schemas.ts:115-133` (`HandbookConfigSchema.passthrough()`)
- **Problem**: ADR 022 says the loader "rejects malformed shapes." `.passthrough()` is the opposite -- unknown fields slip through unchecked. The Python loader has its own validator for ingest knobs (`tools/handbook-ingest/ingest/config_loader.py`), so this is a "split contract" problem: a typo in `outline_strategy: bookmrk` (typo) is caught by the Python loader but never by the TS loader. TS-only consumers of the handbook YAML (the downloader) won't know the typo exists.
- **Rule**: ADR 022 ("loader rejects malformed shapes"); project rule "no magic strings."
- **Fix**: Replace `.passthrough()` with `.strict()` and explicitly enumerate every ingest-side field the Python tool needs (mirroring the `HandbookConfig` dataclass in `config_loader.py`). Single source of truth for both TS + Python validators is the `handbooks/<slug>.yaml` file; both validators must accept the same set of keys.

### MINOR: `handbookManifestSchema.kind` accepts every `REFERENCE_KIND_VALUES` member, but the file is by definition a handbook

- **File**: `libs/bc/study/src/handbook-validation.ts:165`
- **Problem**: `kind: z.enum(REFERENCE_KIND_VALUES as [string, ...string[]])` allows `'cfr'`, `'aim'`, `'ac'`, etc. -- but the schema only validates `handbooks/<doc>/<edition>/manifest.json`. A typo `kind: cfr` here would parse and then explode at seed time when the seed builds an FK against `study.reference` rows.
- **Rule**: Schemas express the type they validate -- not "any superset that compiles."
- **Fix**: Narrow to `kind: z.literal('handbook')`. Cross-corpus discrimination belongs in a separate per-corpus schema once those land.

### MINOR: `ManifestEntry.corpus` is duplicated on every entry inside a per-corpus manifest

- **File**: `scripts/sources/download/manifest.ts:32-44` (`ManifestEntry.corpus`)
- **Problem**: `CorpusManifestFile.corpus` already names the corpus once; every entry repeats it. For an AC manifest with 12 docs, `corpus: 'ac'` appears 13 times. ADR 021's example data model puts `corpus` on `ManifestEntry`, so the spec drives it -- but for handbooks, the `HandbookManifestFile.primary` and every chapter/ancillary entry duplicate `corpus: 'handbooks'` too. This is harmless at small scale but invites drift if a misplaced ACS entry gets `corpus: 'ac'` while sitting under `acs/manifest.json` -- the entries-array filter (`r.entries.filter(isEntry)`) doesn't compare entry.corpus to the parent manifest.corpus.
- **Rule**: Don't repeat in-band data without an invariant check.
- **Fix**: Either (a) drop `ManifestEntry.corpus` (compute from the parent manifest), or (b) add a guard in `readCorpusManifest` / `readHandbookManifest` / `readAimCorpusManifest`: `entries.every(e => e.corpus === manifest.corpus)`, returning `null` (manifest invalid) on mismatch.

### MINOR: `hangarReference` and `hangarSource` tables ship in production schema even though FIRC-compliance surface is dormant

- **File**: `libs/bc/hangar/src/schema.ts:72-160`
- **Problem**: ADR 017 declares the FIRC compliance surface dormant. The hangar registry/source-mirror tables remain in `study`/`hangar` schema with no callers in the post-pivot apps (sim/study). They duplicate the `@ab/sources` registry concept (one for hangar BC, one for the new ADR 019 registry). They have full FK + indexes + CHECKs but are unused.
- **Rule**: "No legacy in airboss -- retire on sight."
- **Fix**: Either (a) document them as dormant in a header comment + ADR 017 link (already partially done -- the file mentions wp-hangar-sources-v1) and add a CI guard that warns on read/write paths, or (b) drop the migrations + schema definitions in a follow-up WP. This finding is registry-adjacent, not strictly within the ADR 019 scope.

### MINOR: `CorpusManifestFile.corpus` and `HandbookManifestFile.corpus` types diverge from `Corpus` enumeration

- **File**: `scripts/sources/download/manifest.ts:69-92`
- **Problem**: `CorpusManifestFile.corpus: Corpus` (a TS string union from `args.ts`) but ADR 021 explicitly enumerates `'ac' | 'acs' | 'aim' | 'regs' | 'handbooks'`. `HandbookManifestFile.corpus: 'handbooks'` is a literal. The shape isn't quite consistent: `CorpusManifestFile` accepts every `Corpus` whereas `AimCorpusManifestFile.corpus: 'aim'` is also a literal. A handbook flat-pdf entry (handbooks-extras) would write through `writeManifestEntry`'s "non-handbooks" branch and produce a `CorpusManifestFile` with `corpus: 'handbooks'`, which technically validates but breaks the "per-corpus manifest = one corpus" invariant.
- **Rule**: Discriminated unions over loose enums when shapes diverge.
- **Fix**: Make the four manifest shapes a discriminated union on `corpus`, with `CorpusManifestFile['corpus'] in {'ac','acs','regs','handbooks-extras'}`. Reject parse otherwise.

### NIT: `SOURCES` constant in `libs/aviation/src/sources/registry.ts` overlaps the ADR 019 `SOURCES` constant in `libs/sources/src/registry/sources.ts`

- **File**: `libs/aviation/src/sources/registry.ts` (legacy `Source[]`) vs `libs/sources/src/registry/sources.ts` (`SourceEntry` table)
- **Problem**: Two registries with the same export name (`SOURCES`) and overlapping concept. The legacy one uses `id: 'cfr-14'`; the new one uses `id: 'airboss-ref:regs/cfr-14'`. The legacy registry's `PENDING_DOWNLOAD` sentinel lives in committed code with no caller migration target. The new ADR 019 registry is the future; the legacy one is the past. Per memory rule "no legacy in airboss -- retire on sight."
- **Rule**: Same name, two meanings -- pick one.
- **Fix**: Rename the legacy export to `LEGACY_AVIATION_SOURCES` with a deprecation comment + ADR 019 migration target, then delete in a follow-up WP. Or delete now if no caller depends on it (`grep -r "from '@ab/aviation/sources'"` to confirm).

### NIT: `Edition` lacks `kind: SourceLifecycle` to track per-edition lifecycle independently

- **File**: `libs/sources/src/types.ts:84-89` (`Edition`)
- **Problem**: ADR 019 §2.4 hints at per-edition lifecycle ("each edition having its own `accepted`/`pending` state"), `RegistryReader.getEditionLifecycle(id, edition)` exists in the API, but the `Edition` type carries no lifecycle field. The Phase 2 implementation falls back to the entry's lifecycle ("Phase 2 surfaces the entry's lifecycle when the edition exists; the per-edition lifecycle is a Phase 5+ enhancement when the diff job lands"). When Phase 5 lands, the type and the storage will both need to grow.
- **Rule**: Don't ship API surface that the data model can't support.
- **Fix**: When `entry_edition` lands (per the EDITIONS finding), add `lifecycle: SourceLifecycle NOT NULL DEFAULT 'pending'` on the table; flow through to the `Edition` TS type. `getEditionLifecycle` becomes a real read instead of an entry-lifecycle alias.

## Cross-cutting observations

- **No DB schema for the registry yet -- the Phase 2 in-memory implementation is correct per the spec** ("Phase 2 ships in-memory; persistence is a future WP"), but the persistence WP is not written and is not scheduled. Per the project rule "no undecided 'considerations for future work' -- ask the user for a decision in the same turn," this should be tracked: do it now, schedule a WP, or accept the in-memory limitation with a documented trigger.
- **ID strategy is correct.** `recordPromotion` calls `createId('batch')` from `@ab/utils`, ADR 010 compliant. Static `SourceEntry.id` is the `airboss-ref:` URI (deliberately not a `prefix_ULID`).
- **Drizzle ORM only -- compliant.** No raw SQL anywhere in `libs/sources/`, `libs/aviation/`, `scripts/sources/`. Migrations use parameterized DDL.
- **Schema namespaces.** When the `sources.entry` family lands, it should be a new namespace per ADR 004's pattern (likely `sources`, not `aviation` -- the lib is `@ab/sources`). Adding to `study` would couple the registry to a single BC.
- **YAML config schemas are the strongest part of the pipeline.** `scripts/sources/config/schemas.ts` is a clean, exhaustive Zod-validated boundary. The same pattern needs to be applied to the in-repo derivative manifests (the CRITICAL + first MAJOR finding).

```yaml
review_status: pending
total_issues: 14
critical: 1
major: 6
minor: 5
nit: 2
files_reviewed:
  - libs/sources/src/types.ts
  - libs/sources/src/registry/sources.ts
  - libs/sources/src/registry/lifecycle.ts
  - libs/sources/src/registry/editions.ts
  - libs/sources/src/registry/index.ts
  - libs/sources/src/registry/query.ts (read-through)
  - libs/sources/src/registry-stub.ts
  - libs/sources/src/regs/derivative-writer.ts
  - libs/aviation/src/sources/registry.ts
  - libs/aviation/src/schema/source.ts
  - libs/aviation/src/schema/reference.ts
  - libs/bc/study/src/schema.ts (committed HEAD only -- working tree changes ignored per "don't re-narrate dirty files")
  - libs/bc/study/src/handbook-validation.ts
  - libs/bc/hangar/src/schema.ts
  - scripts/sources/download/manifest.ts
  - scripts/sources/config/schemas.ts
  - scripts/sources/config/loader.ts
  - scripts/sources/config/handbooks/phak.yaml
  - scripts/sources/config/aim.yaml
  - scripts/sources/config/regs.yaml
  - tools/handbook-ingest/ingest/config_loader.py
  - drizzle/0000_initial.sql .. drizzle/0005_silly_crusher_hogan.sql
  - drizzle/meta/0005_snapshot.json
  - In-repo manifest fixtures: ac/61-65/j/manifest.json, acs/ppl-airplane-6c/manifest.json, aim/2026-04/manifest.json, handbooks/phak/FAA-H-8083-25C/manifest.json, regulations/cfr-14/2026-04-22/{manifest,sections}.json
  - Cache-tier manifest fixtures: $AIRBOSS_HANDBOOK_CACHE/{ac,acs,aim,regulations,handbooks}/...
adrs_consulted:
  - 004 (DATABASE_NAMESPACES)
  - 010 (ID_STRATEGY)
  - 017 (firc-compliance-dormant)
  - 018 (source-artifact-storage-policy)
  - 019 (reference-identifier-system)
  - 020 (handbook-edition-and-amendment-policy)
  - 021 (source-cache-flat-naming)
  - 022 (chapter-source-ingestion)
specs_consulted:
  - reference-source-registry-core/spec.md
```
