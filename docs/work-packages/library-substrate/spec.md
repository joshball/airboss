---
id: library-substrate
title: Library substrate -- WP-SUB implementation plan
product: study
category: feature
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-01
owner: agent
depends_on: []
unblocks: []
tags:
  - library
legacy_fields:
  feature: library-substrate
  type: spec
  review_status: done
  shipped_via: PR
  parent: docs/work-packages/library-completeness/spec.md
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# Library substrate (WP-SUB)

Implementation plan for the substrate rename ratified in [library-completeness/spec.md §1](../library-completeness/spec.md). One PR; no projection layer; no migrations (squash-and-reset). After this WP merges, every §6 corpus WP becomes purely additive.

## Anchors

- Parent spec (ratified 2026-05-01): [library-completeness/spec.md](../library-completeness/spec.md)
- Review that drove the substrate approach: [library-completeness/review.md](../library-completeness/review.md)
- ADR 018 -- source-artifact storage policy
- ADR 019 -- reference identifier system (URI scheme already covers every corpus this WP unblocks)
- Wave 1 (PR #386): added `reference.primary_cert`. Preserved unchanged here.
- Wave 2 (PR #389): backfilled `primary_cert` across YAML rows. No interaction with this WP.
- Wave 3a (PR #390): retired `handbooks-overrides.yaml`; `primary_cert` now rides on the section-tree manifest. Whole-doc manifests carry it on the YAML row in `handbooks-noningested.yaml`. WP-SUB preserves both paths.
- Wave 3b (PR #391): new `/library` route family (cert/topic/regulations/handbook). All three readable spines call `getReadableReferenceIds()` -- a single substrate fix lights up all three.
- Wave 4 (PR #392): unit + e2e + orphan checks for the new route family. WP-SUB extends the unit suite; e2e stays green by construction.

## Goal

Stop pretending handbooks are special. Make the substrate corpus-agnostic so AIM, CFR, AC, ACS, NTSB, Chief Counsel, SAFOs, InFOs, and every future corpus seed into the same table without per-corpus schema changes.

## Non-goals

- **Not** seeding any new corpus. AIM / CFR / AC / ACS seed in their own follow-on WPs (§6 of the parent spec).
- **Not** changing the library page UI. The cert/topic/regulations/handbook routes keep working byte-identically.
- **Not** introducing new validation surfaces beyond what the manifest schemas already do.
- **Not** touching ADR 019 (URI scheme) or `@ab/sources` corpus resolvers' citation contracts.
- **Not** addressing the "ingested + readable" vs "umbrella + link-only" card-state distinction (smell #5; separate UX WP).

## What changes

### 1. Schema renames

- `study.handbook_section` -> `study.reference_section`
- `study.handbook_figure` -> `study.reference_figure`
- `study.handbook_section_errata` -> `study.reference_section_errata`
- `study.handbook_read_state` -> `study.reference_section_read_state` (the FK column `handbook_section_id` becomes `reference_section_id`)
- Drizzle constants: `handbookSection`, `handbookFigure`, `handbookSectionErrata`, `handbookReadState` -> `referenceSection`, `referenceFigure`, `referenceSectionErrata`, `referenceSectionReadState`.
- Type aliases: `HandbookSectionRow` / `NewHandbookSectionRow` -> `ReferenceSectionRow` / `NewReferenceSectionRow`.
- Constants module: `HANDBOOK_SECTION_LEVEL_VALUES`, `HANDBOOK_SECTION_LEVELS`, etc. -> `REFERENCE_SECTION_LEVEL_VALUES`, `REFERENCE_SECTION_LEVELS`, etc.
- ID prefix: `hbs_ULID` -> `refsec_ULID` (in `libs/utils/src/ids.ts` -- bump the prefix; rows get fresh IDs on re-seed since we squash-and-reset).
- Errata ID prefix unchanged (it's already corpus-agnostic).

### 2. Constraints removed

Drop these from `reference_section` (per [parent spec §1 step 2](../library-completeness/spec.md#the-fix-rename--relax--generalize)):

- `level IN ('chapter','section','subsection')` CHECK -- replaced by per-kind ingest-time Zod validation against `reference.section_schema.levels`.
- `code ~ '^[0-9]+(\.[0-9]+){0,2}$'` regex CHECK -- replaced by per-kind ingest-time regex (handbooks keep the dotted shape; CFR uses `91.103(b)(1)(i)`-style; AIM uses `5-2-1`-style).
- `parent_level_check` (the relationship constraint on parent.level vs child.level) -- replaced by `section_schema.strict_sequence` validation at ingest.

Drop from `reference`:

- `kind` CHECK against `REFERENCE_KIND_VALUES`. Per ratification (1.A) and the kind-row note in the parent spec: Zod-validated at ingest is the single source of truth. Adding a corpus shouldn't need a schema change.

Kept as-is:

- `code_shape_check` constraints inside ingest-time Zod (just not at the DB layer).
- `ordinal >= 0` CHECK (corpus-agnostic, cheap).
- `faa_pages_check` (handbook-specific but stays since the columns are kept; only enforced when both columns are non-null, which is the only valid handbook state).
- All `reference` CHECKs other than `kind`: `document_slug` shape, `edition` length, `subjects` enum membership.
- `reference.primary_cert` and its CHECK (PR #386).

### 3. New columns

On `reference`:

- `section_schema jsonb NOT NULL DEFAULT '{}'::jsonb`. Shape: `{ levels: string[], strict_sequence?: boolean }`.
- `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`. Per-kind extras.

On `reference_section`:

- `depth int NOT NULL`. 0 = top-level child of the reference; ++ per nesting. Positional only -- not a 1:1 map to `level`.
- `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`. Per-kind per-section extras.

Defaults are `'{}'::jsonb` (empty object) so existing rows don't need backfill on the squash-and-reset path; new rows that don't populate `metadata` get the empty object.

### 4. Two manifest shapes from day one

The seeder accepts both natively. The Zod validator branches on each manifest's own `kind` field (manifest's kind, not REFERENCE_KIND).

#### Section-tree manifest (`kind: handbook`)

Today's PHAK / AFH / AVWX shape. Schema in `libs/bc/study/src/handbook-validation.ts`:

```text
document_slug, edition, kind: 'handbook', title, publisher, source_url,
subjects[], primary_cert?, sections[], figures[], ...
```

Seeder produces N `reference_section` rows in a chapter/section/subsection tree. The reference row gets:

- `section_schema = { levels: ['chapter', 'section', 'subsection'], strict_sequence: true }`

#### Whole-doc manifest (`kind: whole-doc`)

The post-#384 handbooks-extras shape. Schema (new, lives next to `handbook-validation.ts`):

```text
document_slug, edition, kind: 'whole-doc', title, publisher, source_url,
body_path, body_sha256, page_count?, doc_id?, faa_edition?
```

No `subjects` (the YAML row carries them; whole-doc is a fallback shape until/if a section-tree exists). No `sections` array. No `figures`.

Seeder produces:

- One `reference` row (or upserts an existing one from the YAML seed).
- One `reference_section` row at depth 0:
    - `level = 'document'`
    - `code = '1'` (single literal -- whole-doc has one section by definition)
    - `ordinal = 0`
    - `parent_id = NULL`
    - `content_md` = body file contents
    - `content_hash = body_sha256`

The reference row gets:

- `section_schema = { levels: ['document'], strict_sequence: true }`
- `metadata = { source_pdf_pages: page_count, doc_id, faa_edition }` (whatever's useful that isn't a column)

#### Validator shape

```typescript
// libs/bc/study/src/handbook-validation.ts (renamed: manifest-validation.ts)
export const sectionTreeManifestSchema = z.object({
  kind: z.literal('handbook'),
  // ... existing fields
});

export const wholeDocManifestSchema = z.object({
  kind: z.literal('whole-doc'),
  document_slug: z.string()...,
  edition: z.string()...,
  title: z.string(),
  publisher: z.string(),
  source_url: z.string().url(),
  body_path: z.string(),
  body_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  page_count: z.number().int().positive().optional(),
  doc_id: z.string().optional(),
  faa_edition: z.string().optional(),
});

export const manifestSchema = z.discriminatedUnion('kind', [
  sectionTreeManifestSchema,
  wholeDocManifestSchema,
]);
```

The seeder reads `manifest.json`, calls `manifestSchema.parse()`, and dispatches on the discriminator.

### 5. Readability probe

`getReadableReferenceIds()` at `libs/bc/study/src/handbooks.ts:528` (will move to `references.ts` post-rename):

```typescript
// Before
sql`${handbookSection.level} <> ${HANDBOOK_SECTION_LEVELS.CHAPTER}`

// After
sql`${referenceSection.contentMd} IS NOT NULL AND ${referenceSection.contentMd} <> ''`
```

Behavior change: a chapter row with non-empty `content_md` (rare today; PHAK chapters have a brief intro that gets stored on the chapter row) now counts as readable. Existing handbook content all has child sections, so no chapter-only references exist; the change is forward-looking. CFR / AIM / etc. produce non-chapter rows by definition, so this only matters for whole-doc handbooks (where the document row itself is what's readable -- exactly the desired behavior).

### 6. Generalized seeder

`scripts/db/seed-handbooks.ts` -> `scripts/db/seed-references-from-manifest.ts`. Same entry point in `seed-all.ts` (renamed). The seeder:

1. Walks `handbooks/*/<edition>/manifest.json` (and later `aim/<edition>/manifest.json`, `regulations/cfr-*/<edition>/manifest.json`, etc., as those WPs land).
2. For each manifest: `manifestSchema.parse()`, dispatch on `kind`.
3. Section-tree path: existing `seedEdition()` logic, renamed table writes.
4. Whole-doc path: new code. Read `body_path` file, upsert reference (empty `subjects` if not on manifest -- the YAML seed already populated them), upsert single `reference_section` with body.
5. Idempotence: same `content_hash` mechanism on `reference_section`. Whole-doc uses `body_sha256` from the manifest as the hash.

Per-corpus adapters (one file per corpus) live under `libs/bc/study/src/seeders/`:

- `handbooks-section-tree.ts` -- the existing path
- `handbooks-whole-doc.ts` -- new
- (future) `aim.ts`, `cfr.ts`, `ac.ts`, `acs.ts`

Seeder core in `scripts/db/seed-references-from-manifest.ts` is just dispatch + commit/transaction handling.

### 7. Move external-URL formatting onto resolvers

Smell #4 from the parent spec. Retire the `kind` switch in `externalUrlForReference()` at `libs/constants/src/study.ts:1496`. Each `CorpusResolver` already has a `formatCitation()` slot; add `externalUrlFor(reference)` to the same protocol.

Touch points:

- `libs/sources/src/registry/corpus-resolver.ts` -- add `externalUrlFor` to the interface.
- `libs/sources/src/handbooks/resolver.ts`, `aim/resolver.ts`, `ac/resolver.ts`, `acs/resolver.ts`, `regs/resolver.ts` -- implement `externalUrlFor`.
- The library page server loaders read `externalUrlForReference()` from constants today; flip them to call `resolverFor(kind).externalUrlFor(reference)`.

This step is cosmetic for behavior (the URLs come out the same) but consolidates per-kind URL knowledge in one place per corpus.

## What stays the same

- `study.reference` rows -- structure unchanged except for `section_schema` + `metadata` jsonb additions. `primary_cert` (PR #386), `subjects`, `superseded_by_id`, `seed_origin` -- all preserved.
- `study.reference_section_read_state` semantics -- per-(user, section) row stays. Only the column rename ripples through.
- ADR 019 URI scheme -- untouched. `airboss-ref:handbooks/phak/...?at=FAA-H-8083-25C` resolves to the same row, just via a renamed table.
- Citation resolvers -- untouched. They already key off `(document_slug, edition)`.
- Wave 4 e2e tests -- pass by construction since the route family loaders are unchanged structurally; only the names of the things they import shift.

## Acceptance criteria

The WP closes when **all** of the following hold:

1. `bun run check` passes with 0 errors, 0 warnings.
2. `bun run db reset && bun run db seed` runs to completion without errors.
3. `SELECT count(*) FROM study.reference_section GROUP BY (SELECT document_slug FROM study.reference WHERE id = reference_section.reference_id)` returns rows for **all 9 handbooks** -- 3 sectioned (PHAK ~850, AFH ~531, AVWX ~480) + 6 whole-doc (risk-mgmt, instructor, IFH, IPH, AMT-G, AMT-P) at one row each.
4. `getReadableReferenceIds(allReferenceIds)` returns a Set containing all 9 handbook reference IDs.
5. `/library/cert/private`, `/library/topic/aerodynamics`, `/library/regulations/cfr`, and `/library/handbook/phak` all render without server errors and show their respective content lists exactly as they do on main today.
6. Existing handbook reader pages (`/library/handbook/[slug]/[chapter]/[section]`) render the right body content for at least one chapter from each of the 3 sectioned handbooks.
7. The 6 whole-doc handbook references show as readable (`isReadable: true`) on the cert/topic spines.
8. Wave 4's existing test suite (`tests/e2e/library-by-cert.spec.ts` + `libs/bc/study/src/library-by-cert.test.ts`) passes unchanged.
9. New unit test in `libs/bc/study/src/seeders/` covers both manifest shapes -- section-tree and whole-doc -- and asserts row counts and content hashes match expectations.
10. `course/references/handbooks-noningested.yaml` is **not** deleted in this WP. (Smell #1 cleanup is a follow-up.)

## Out of scope (deliberately deferred)

- Smell #1 cleanup: `course/references/handbooks-noningested.yaml` retirement. Trigger: after WP-SUB merges and the 6 extras seed cleanly, audit and delete in a follow-up PR. The `afh@FAA-H-8083-3B` row stays until a content audit.
- Smell #2: corpus-module registration boilerplate consolidation.
- Smell #3: phase-numbered reviewer IDs -> per-corpus reviewer IDs.
- Smell #5: `/library` card-state indicator (Read · Browse · External link only).
- Any new corpus seed (AIM, CFR, AC, ACS, mountain-flying, etc.). Each is its own WP per parent spec §6.

## Risks and mitigations

| Risk                                                                                        | Mitigation                                                                                          |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Squash-and-reset means losing any locally-modified rows that aren't reproducible from seed. | We're pre-launch, single dev. The user has confirmed reset is the workflow.                         |
| Drizzle generates a destructive migration for the renames.                                  | We bypass Drizzle migrations for this WP -- schema file is the source of truth, `db reset` reseeds. |
| `getReadableReferenceIds` change affects a chapter-only row somewhere.                      | None exist today (verified -- every chapter has children). Future-proof for whole-doc.              |
| Whole-doc seed doesn't write anything for the 6 extras.                                     | Acceptance criterion #3 explicitly checks row counts. CI reproduces.                                |
| `kind` CHECK drop loses validation.                                                         | Zod at ingest is stricter than the DB CHECK ever was (closed enum + every other field validated).   |
| Test files import renamed types and break en masse.                                         | All in one commit. `bun run check` is the gate.                                                     |
| Generated `.svelte-kit/types/` files reference renamed imports.                             | Cleared by `bunx svelte-kit sync` (already in `scripts/check.ts`).                                  |

## Effort estimate

Single PR. Three logical chunks:

1. **Substrate rename** (mechanical): ~30 file touches across schema/constants/BC/seeder/routes/UI/tests. Largely automated via `s/handbookSection/referenceSection/g`-style passes plus hand-fixing imports.
2. **Two-shape seeder** (the only real engineering): new `wholeDocManifestSchema`, new whole-doc seed path, dispatch in the seed core, new unit tests.
3. **External-URL resolver move** (cosmetic): add interface method to corpus resolvers, swap callers.

No follow-up sweeps. The WP closes when acceptance criteria pass.

## Open questions for ratification before implementation

> **Ratify (SUB.1):** Confirm ID prefix change `hbs_` -> `refsec_`. Default = yes (squash-and-reset means no row migration). Alternative: keep `hbs_` for handbook-section rows specifically and use `refsec_` only for new corpus rows -- but that bakes the "handbooks are special" lie back in.

> **Ratify (SUB.2):** Confirm `study.handbook_read_state` -> `study.reference_section_read_state` is in scope. Default = yes (consistency, and the FK column rename is mandatory anyway). Alternative: leave the table named `handbook_read_state` since it's user-facing data that survives across edition resets -- but the column inside it is `reference_section_id`, so the table name disagreement is jarring.

> **Ratify (SUB.3):** Confirm the renamed seeder file path: `scripts/db/seed-references-from-manifest.ts`. Default = yes. Alternative: keep `seed-handbooks.ts` for one cycle and add a corpus parameter -- saves a `seed-all.ts` edit and one path reference, costs another generation of the misnaming we're trying to fix.

> **Ratify (SUB.4):** Confirm that `seed-references.ts` (the YAML seeder for ACS/PTS/AC/AIM/CFR/POH/NTSB/Other umbrella rows) is **left unchanged** by WP-SUB. It already produces `reference` rows and has no relationship to the `handbook_section` substrate. Default = yes; future corpus WPs may rename it for symmetry but that's their call.

Default for all four = proceed as written. If you ratify all defaults wholesale, this spec is ready to implement; reply with "go" or with deviations.
