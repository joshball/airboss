---
title: 'ADR 026 -- edition coherence (registry as source of truth)'
status: proposed
date: 2026-05-06
authors: Joshua Ball
related:
  - docs/decisions/018-source-artifact-storage-policy/decision.md
  - docs/decisions/019-reference-identifier-system/decision.md
  - docs/decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md
  - docs/decisions/020-handbook-edition-and-amendment-policy.md
incorporates_reviews:
  - ../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md
---

# ADR 026 -- edition coherence (registry as source of truth)

The schema currently models "edition" three independent ways. ADR 019 §6.1 already named `sources_registry.editions` as the canonical home; ADR 020 documented the FAA's edition cadence; the optional-edition amendment (2026-05) sharpens the question further. This ADR closes the loop: the registry is the single source of truth, the two carryover edition stores in `study.*` become a read-time resolution problem (not authored state), and the amendment's drift sentinels read the registry directly.

## Index

- [Context -- three parallel edition stories](#context----three-parallel-edition-stories)
- [Decision](#decision)
- [Self-review](#self-review)
- [Worked example -- current state (AFH 3B legacy + in-flight syllabi + amendment branch)](#worked-example----current-state-afh-3b-legacy--in-flight-syllabi--amendment-branch)
- [Worked example -- happy path (a new corpus joins the registry)](#worked-example----happy-path-a-new-corpus-joins-the-registry)
- [Migration path](#migration-path)
- [Acceptance criteria](#acceptance-criteria)
- [Out of scope -- captured for future work](#out-of-scope----captured-for-future-work)

## Context -- three parallel edition stories

[Review 2026-05-06 §A](../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md#a-critical-three-parallel-edition-stories-that-dont-know-about-each-other) flagged three independent edition mechanisms, none of which know about the others:

| Mechanism                                      | Where authored                      | What it tracks                                           | Lifecycle                                     |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `sources_registry.editions`                    | ADR 019 §6.1, hangar promotion flow | Per-`SOURCES`-entry edition history, retired-at, aliases | `retiredAt` partial index = "current edition" |
| `study.reference.edition` + `superseded_by_id` | Per-edition `manifest.json` seed    | Edition string per `(documentSlug, edition)` row + chain | `WHERE superseded_by_id IS NULL` = "current"  |
| `study.syllabus.edition` + `superseded_by_id`  | Per-syllabus YAML seed              | ACS / PTS edition + chain                                | `WHERE superseded_by_id IS NULL` = "current"  |

The amendment 2026-05 ("optional edition + drift sentinels") makes the picture more brittle. The validator becomes precision-aware about edition pinning and drift-aware via sentinels (`chapter_title`, `section_title`, etc.), but it can only consult one of the three. Whichever it consults is "right" for that corpus and silently wrong for the others.

Concrete failure modes already latent on main:

1. **Promotion drift.** Promote a new AFH edition via the registry (`sources_registry.editions` writes the row, retires the prior). `study.reference.superseded_by_id` is not updated: the handbook reader's "newer edition available" banner reads the wrong field and misses the change until a separate seed runs.
2. **Syllabus drift.** Author a new ACS edition (`syllabus.superseded_by_id` set). The registry doesn't know. `airboss-ref:acs/...` resolution that consults the registry returns the wrong "current."
3. **Sentinel-vs-mirror drift.** The amendment's drift sentinels look up `chapter_title` against "current edition," but "current" in `sources_registry.editions` and "current" in `study.reference` can disagree by one sync window.

ADR 019 §2 + §6.1 already designate the registry as the source of truth for source identity, edition history, and supersedes chains. The two `study.*` mirrors are pre-ADR-019 carryover that the project never closed out.

## Decision

`sources_registry.editions` is the single source of truth for edition identity, edition history, retire-at semantics, and the supersedes chain. `study.reference.edition` becomes a denormalized cache populated by the seed from the registry (read-only after seed). The two `superseded_by_id` columns on `study.reference` and `study.syllabus` are dropped. The amendment's drift sentinels read the registry directly, not per-corpus mirrors.

### 1. Registry-canonical (load-bearing)

Every consumer that needs to know "what is the current edition for this slug?" reads from `sources_registry.editions` (`WHERE source_id = ? AND retired_at IS NULL` -- the existing partial index). No code path reads `study.reference.superseded_by_id` or `study.syllabus.superseded_by_id` after this ADR ships.

This is **load-bearing.** Without it, the validator + drift sentinels + amendment resolver cannot agree on "current," and ADR 019's promise (one source of truth for resolution) breaks.

### 2. Deprecation contract for the two `superseded_by_id` columns (load-bearing)

Both columns are dropped:

- `study.reference.superseded_by_id` (libs/bc/study/src/schema.ts:1415)
- `study.syllabus.superseded_by_id` (libs/bc/study/src/schema.ts:1988)

Read-time resolution replaces them:

- "Is this reference superseded?" = `EXISTS (SELECT 1 FROM sources_registry.editions e WHERE e.source_id = airboss_ref_for(reference) AND e.retired_at IS NOT NULL)`.
- "What's the current edition for this slug?" = `SELECT * FROM sources_registry.editions WHERE source_id = ? AND retired_at IS NULL LIMIT 1`.

Resolver helpers live in `@ab/sources` (next to the existing `Edition` type and `getEditionsMap`). BC consumers (`libs/bc/study/src/references.ts`, `libs/bc/study/src/library-by-cert.ts`, `libs/bc/study/src/syllabi.ts`, `libs/bc/study/src/regulations.ts`) call the resolver instead of reading the dropped column.

### 3. Denormalized-cache contract for `study.reference.edition` (conservative default)

`study.reference.edition` (text, NOT NULL, line 1348) stays as a column for two reasons: it backs the `(document_slug, edition)` unique index that the seed conflict-targets, and route handlers + form-action validation today read it without rebuilding from the registry. The contract changes:

- The seed populates `study.reference.edition` from `sources_registry.editions.edition_label` at seed time. **Seed is the only writer.**
- No code path mutates the column after seed. No form action, no admin UI, no migration script writes a different value.
- A CI check (added in commit 1's tasks) greps the codebase for non-seed writes to `reference.edition` and fails the build if any land outside the seed module.

This is a **conservative default.** A future refactor can drop the column entirely and resolve at read time; today the column stays because removing it touches every reader and the registry-as-truth invariant is satisfied as long as the seed is the only writer. Revisit when the next migration window allows a multi-call-site refactor.

### 4. `study.syllabus.edition` (conservative default)

`study.syllabus.edition` (text, NOT NULL) stays. Syllabi (ACS / PTS / school / personal) have looser FAA cadence than handbooks; many syllabi are personal tracks where "edition" is free-form text and there is no registry entry. The registry-canonical rule applies only to syllabi that correspond to a registered FAA publication (ACS, PTS); the seed reconciles those at seed time. Personal / school syllabi keep authoring their own edition string.

This is a **conservative default**, not load-bearing. Revisit when more than half of authored syllabi are FAA publications. Today the personal-syllabus surface is the dominant case.

### 5. Amendment drift sentinels read the registry (load-bearing)

The amendment's drift-sentinel work (per [amendment-2026-05-optional-edition.md §2](../019-reference-identifier-system/amendment-2026-05-optional-edition.md#2-drift-sentinels)) looks up `chapter_title`, `section_title`, etc. against "current edition." After this ADR, that lookup goes to `sources_registry.editions` directly. The amendment's implementation lives in `@ab/sources`'s resolver layer; this ADR formalizes which table the resolver reads.

This is **load-bearing.** A drift sentinel that reads a stale mirror is worse than no sentinel at all: it surfaces drift NOTICEs based on a state that doesn't match what the registry says is current.

### 6. Read-side helper API in `@ab/sources` (load-bearing)

A small read-only API consolidates the resolver paths:

```typescript
// libs/sources/src/registry/edition-resolver.ts
export async function getCurrentEdition(sourceId: string): Promise<EditionRow | null>;
export async function getEditionByLabel(sourceId: string, label: string): Promise<EditionRow | null>;
export async function isEditionSuperseded(sourceId: string, label: string): Promise<boolean>;
export async function listEditionsForSource(sourceId: string): Promise<readonly EditionRow[]>;
```

Every consumer that previously called `isNull(reference.supersededById)` or `isNull(syllabus.supersededById)` calls one of these helpers. The helpers are server-only (they query `sources_registry.editions`); they expose no value-shaped runtime types that could leak into the client bundle.

This is **load-bearing.** Without a single API, every consumer would re-implement the registry probe, which re-introduces the drift this ADR is closing.

## Self-review

Per [docs/decisions/README.md §"Self-review checklist"](../README.md#self-review-checklist):

### 1. For each constraint: load-bearing or conservative default?

| Constraint                                                                  | Kind                 | Why                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry is THE source of truth                                             | Load-bearing         | Without this, validator + sentinels + resolver disagree; ADR 019's promise breaks.                                                                                                  |
| Drop `study.reference.superseded_by_id` + `study.syllabus.superseded_by_id` | Load-bearing         | Keeping them keeps the drift surface alive; the schema must commit to one model.                                                                                                    |
| Drift sentinels read `sources_registry.editions`                            | Load-bearing         | A sentinel against a stale mirror is worse than no sentinel.                                                                                                                        |
| Single resolver API in `@ab/sources`                                        | Load-bearing         | Diffuse re-implementations re-introduce the drift the ADR closes.                                                                                                                   |
| `study.reference.edition` stays as denormalized cache, seed-only writer     | Conservative default | Keeping the column is friction; dropping it touches every reader. Revisit at next migration window. Failure mode if relaxed: a non-seed write would drift the cache; CI catches it. |
| `study.syllabus.edition` stays free-form for personal syllabi               | Conservative default | Most syllabi today are personal, not FAA. Revisit when FAA-syllabus share crosses 50%.                                                                                              |
| CI check forbids non-seed writes to `reference.edition`                     | Load-bearing         | The denormalized-cache contract has no teeth without enforcement.                                                                                                                   |

Two conservative defaults are explicitly labeled. Each carries a "revisit when X" trigger so the next author who hits the friction has a defined off-ramp.

### 2. Mechanical sweep tool to absorb friction?

No annual diff job, no codemod, no per-row rewrite pass. The migration drops two columns and updates the readers; after that, no recurring sweep is needed. The amendment's drift-sentinel work already absorbs the "edition cycle" friction without per-row rewrites (per [amendment §2](../019-reference-identifier-system/amendment-2026-05-optional-edition.md#2-drift-sentinels)).

### 3. Worked example walks through current state?

Yes -- the [current state worked example](#worked-example----current-state-afh-3b-legacy--in-flight-syllabi--amendment-branch) walks through three messy parts of the project: the AFH 3B legacy citations, the in-flight ACS syllabi, and the amendment branch's drift-sentinel substrate. The [happy-path example](#worked-example----happy-path-a-new-corpus-joins-the-registry) covers the future state.

## Worked example -- current state (AFH 3B legacy + in-flight syllabi + amendment branch)

The project's current state has three messy parts that this ADR has to handle without breaking:

### Part A: 15 free-text AFH 3B citations in `course/knowledge/`

Today: 15 knowledge nodes carry `references: [{source: 'AFH', detail: '...', note: '...'}]` (legacy `LegacyCitation` shape) where the citation text mentions FAA-H-8083-3B. The amendment branch's `migrate-knowledge-citations` script (per [amendment review-amendment-2026-05-06.md](../019-reference-identifier-system/review-amendment-2026-05-06.md)) is wired to convert these to `StructuredCitation` shape with the optional-edition relaxation.

After this ADR:

1. The amendment script runs and produces structured citations. 14/15 resolve to `airboss-ref:handbooks/afh/<chapter>` (no edition pin) -- chapter-level, no precision that demands a pin.
2. One citation pinned to a page number resolves to `airboss-ref:handbooks/afh/8083-3B/<chapter>?page=...` (still pinned).
3. At read time, `getCurrentEdition('airboss-ref:handbooks/afh')` returns the row for `8083-3C` (the registry's current edition; `retired_at IS NULL`). The 14 unpinned citations resolve to 3C content.
4. The 1 pinned citation resolves to 3B content. The registry has a `retired_at`-set row for `8083-3B`, and `getEditionByLabel('airboss-ref:handbooks/afh', '8083-3B')` returns it.

No `study.reference.superseded_by_id` walk anywhere. The registry is the only walker.

### Part B: in-flight ACS syllabi with `superseded_by_id` in flight

Today: `study.syllabus` rows for the PPL ACS exist with `superseded_by_id` set on the prior FAA publication. The seed wires the chain at seed time.

After this ADR:

1. The migration in commit 6 of the schema-review-followup PR drops the `study.syllabus.superseded_by_id` column.
2. The seed for FAA-publication syllabi now reads from `sources_registry.editions` to determine the current edition for `airboss-ref:syllabi/acs-ppl` (or whichever slug) and writes that into `study.syllabus.edition`.
3. Personal syllabi (kind = 'school' / 'personal') don't go through the registry; their edition string is whatever the author wrote.
4. The library + cert-spine readers in `library-by-cert.ts` call `isEditionSuperseded(...)` to filter out superseded ACS rows. The personal-syllabus surface unchanged.

### Part C: amendment branch's drift-sentinel substrate

The amendment branch (`feat/adr-019-amendment-optional-edition`) ships:

- WELL_KNOWN_CITATION_FIELDS (validator)
- `redirected_from` annotation (resolver)
- `migrate-knowledge-citations` script (review-queue migration)
- structured-citation acceptance in `build-knowledge-index`

This ADR's PR rebases on top of the amendment branch. The amendment's resolver (`resolveCitationsForRender`) is correct relative to `study.reference` today; after this ADR's commits land, the same resolver reads `sources_registry.editions` for the "current edition" probe. The amendment's user-visible behavior does not change; only the storage path does.

The amendment's NOTICE/REVIEW state machine for sentinel-laundering is unaffected -- it's purely a validator concern and doesn't depend on which table holds "current edition."

## Worked example -- happy path (a new corpus joins the registry)

A new corpus arrives: NTSB safety alerts (`airboss-ref:ntsb-safety-alert/<id>`).

1. The ingest pipeline writes one `sources_registry.editions` row per published alert version with `published_at` set; `retired_at` is NULL.
2. The seed for `study.reference` writes one row per alert with `kind = 'ntsb-safety-alert'`, `documentSlug = '<slug>'`, `edition = '<label-from-registry>'`. Conflict-target on `(document_slug, edition)`. The seed reads `editions.edition_label` -- it does not author its own.
3. A learner's knowledge node cites the alert via `airboss-ref:ntsb-safety-alert/<id>` (no edition pin).
4. The reader resolves the citation via `getCurrentEdition('airboss-ref:ntsb-safety-alert/<id>')`, which returns the live edition row, which leads to the `study.reference` row via the seed-cached `edition` column.
5. A new alert version drops. The ingest pipeline writes a new `editions` row and sets `retired_at` on the prior. No `study.reference.superseded_by_id` walk. The reader's "current" probe lands on the new row.

No carryover walks. No `superseded_by_id` chains anywhere. One source of truth.

## Migration path

Three commits in the schema-review-followup PR (this PR's siblings):

1. **This ADR (proposed -> accepted).** Status flips to `accepted` after sign-off. ADR is authoritative once accepted.
2. **Drop the two `superseded_by_id` columns.** Two `bun run db push` migrations:
   - Update `libs/bc/study/src/schema.ts`: remove `supersededById` from `reference` and `syllabus`. Drop `referenceDocSupersededIdx` (the index that included it).
   - Update every reader that referenced the column (`isNull(reference.supersededById)` -> `isNotEditionSuperseded(...)` resolver call). The list is closed: `library-by-cert.ts`, `references.ts`, `syllabi.ts`, `regulations.ts`, the route handlers in `apps/study/src/routes/(app)/library/handbook/[slug]/+page.server.ts`, the seed scripts.
   - Update `study.reference.edition` writers: ensure the seed reads from the registry, not from the per-edition manifest's edition string. Manifest's edition string becomes a verification probe (must match the registry); a mismatch is a seed-time error.
3. **Add the resolver API + CI check.**
   - `libs/sources/src/registry/edition-resolver.ts` exports the helpers above.
   - `scripts/lint/edition-cache-write-guard.ts` greps the codebase for `reference.edition` writes outside `libs/bc/study/src/seeders/` + `scripts/db/seed-references-from-manifest.ts`. CI fails on a non-seed write. Wired into `bun run check`.

This ADR landing closes commit 2 of the schema-review-followup PR (the amendment doc gains a "lands on top of" pointer to ADR 026). The migration commits land in a follow-on PR after this ADR is `accepted`; this PR only writes the ADR.

## Acceptance criteria

The ADR is `accepted` when:

1. The user signs off on the registry-canonical decision (load-bearing items 1, 2, 5, 6).
2. The user signs off on the two conservative-default labels (items 3, 4) including the revisit triggers.
3. The Self-review section is reviewed and the three questions are explicitly answered.
4. ADR 019 amendment 2026-05 carries a "lands on top of" or "Lessons" reference to ADR 026 (commit 2 of this PR series).
5. `docs/decisions/README.md` is updated with an entry for ADR 026 (this commit).

The migration commits (resolver API, column drops, CI check) land in a follow-on PR per the [Migration path](#migration-path) above. This ADR's commit is documentation only.

## Out of scope -- captured for future work

Per the project rule "no undecided considerations for future work," each item below has a defined trigger.

- **B (drop or generate `study.reference_section.airboss_ref`).** Triggered when ADR 019's path-grammar evolves -- current shape is stable; depends on this ADR's resolver API to land first.
- **C (move `study.knowledge_node.references` jsonb -> `content_citations` rows).** Triggered when the amendment's sentinel-vocabulary work in flight stabilizes; depends on this ADR's resolver API to be in place so the per-citation rows can drift-check.
- **D (migrate `study.scenario.regReferences` jsonb -> `content_citations`).** Triggered alongside C; same dependency on the resolver API.
- **G (CHECK enforcing "edition-sensitive locator implies edition pinned").** Triggered alongside C: when sentinel + edition columns land on `content_citations`, a CHECK is the natural defense-in-depth. Review concedes this is structurally fine without it; promote to "do" only when C lands.
- **L (standardize string-list representation -- `text[]` for enum arrays, `jsonb` only for shape-bearing).** Triggered when the next batch of array columns is touched; convention-only doc + per-pass tightening.
- **O (standardize "completed" column names across `session.completedAt`, `hangar.review_session.finishedAt`, `sim.attempt.endedAt`, `card_snooze.resolvedAt`).** Triggered alongside next session-table touch; convention-only doc.
- **NIT T (enum-name suffix `STATUSES` vs `_VALUES`).** Triggered next time a new status set lands; ages out as the project's pattern fixes itself.
- **NIT U (`study.reference_section_errata.publishedAt` -> `date` mode).** Triggered next time errata seeders are touched; defensive-only.
- **NIT X (verify planner picks `auditTargetTypeTimeIdx` for `targetId IS NULL` reads).** Documentation-only EXPLAIN check; ages out when the index is exercised in production load.
- **NIT Y (partial index `WHERE review_session_id IS NOT NULL` on `study.review`).** Triggered when legacy review-row count is large enough to matter (>10k rows -- check via `count(*) WHERE review_session_id IS NULL` quarterly).
- **NIT Z (indexes on `hangar.invitation.acceptedUserId` + `revokedByUserId`).** Triggered when invitation volume crosses the threshold where user-delete cascade time exceeds 100ms. Today: low volume, ages out for now.
- **NIT AA (FK `sources_registry.promotion_batches.reviewerId` -> `bauth_user.id` with RESTRICT).** Triggered by Phase 3 of the `promotion-batches-persistence` work package landing; the comment in schema already calls it out.
- **M (`sim.attempt.scenario_id` closed-set CHECK against `SIM_SCENARIO_ID_VALUES`).** Triggered next time `sim.attempt` schema is touched, or superseded when `sim_scenario` materializes as a real table (FK replaces the value check). Mirrors the `reference_subjects_values_check` pattern (`scenario_id <@ ARRAY[<SIM_SCENARIO_ID_VALUES>]::text[]`); the original review proposed `~ '^sce_'`, which does not match the kebab-case slugs the BC actually uses (`pitot-block`, `vmc-into-imc`, etc.; see [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts)).
- **P (`hangar.source.path` shape CHECK + length cap).** Triggered next time `hangar.source` is touched; defense-in-depth only, the loader is the only writer today.
- **Q (`hangar.docs_search_index.path` PK race risk).** Triggered when the docs-search loader runs concurrently or multiple workspaces share the docs index; flag-only today, single-process is safe.
- **R (`study.knowledge_node.references` second GIN with `jsonb_ops` opclass).** Triggered when amendment 2026-05's sentinel work needs `?` / `?|` / `?&` key-existence operators; today the existing `jsonb_path_ops` index is correct for the only consumer (`getNodesCitingSection` containment).
- **S (`study.session.items` invariant docstring).** Triggered next time `study.session` schema or `session_item_result` consumers are touched; two-line docstring noting `items[i]` and `session_item_result.slot_index = i` must agree on `(cardId|scenarioId|nodeId|teachingExerciseId)`.
- **W (`study.user_pref.value` JSON-null CHECK `(jsonb_typeof(value) <> 'null')`).** Triggered next time `study.user_pref` is touched, or when a JSON-null bug is observed in BC `setUserPref`; optional defense-in-depth.
