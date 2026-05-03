---
title: 'Tasks: Stage-5 citation deep-linking'
product: study
feature: stage5-citation-deeplink
type: tasks
status: unread
review_status: pending
---

# Tasks: Stage-5 citation deep-linking

## Pre-flight

- [ ] Read [spec.md](spec.md) end to end -- especially the data-model decision and the open-questions resolutions.
- [ ] Read [design.md](design.md) -- schema diff, helper signatures, picker tab consolidation.
- [ ] Read [docs/ingestion-pipeline/pipeline.md](../../ingestion-pipeline/pipeline.md) -- stage-5 framing.
- [ ] Read [libs/bc/study/src/citations/citations.ts](../../../libs/bc/study/src/citations/citations.ts) -- understand the current resolveCitationTargets / verifyTargetExists shape.
- [ ] Read [libs/bc/study/src/citations/search.ts](../../../libs/bc/study/src/citations/search.ts) -- the current per-target-type searches.
- [ ] Read [libs/bc/study/src/citations/corpus.ts](../../../libs/bc/study/src/citations/corpus.ts) -- the corpusForSourceType map shipped in PR #562.
- [ ] Read [libs/sources/src/url-for-reference.ts](../../../libs/sources/src/url-for-reference.ts) -- the existing dispatcher.
- [ ] Read [libs/ui/src/components/CitationPicker.svelte](../../../libs/ui/src/components/CitationPicker.svelte) and [CitationChips.svelte](../../../libs/ui/src/components/CitationChips.svelte).
- [ ] Read [libs/bc/study/src/cards-public.ts](../../../libs/bc/study/src/cards-public.ts) `composePublicCardCitations`.
- [ ] Verify dev DB state: `bun -e "import {db} from '@ab/db/connection'; import {reference, referenceSection} from '@ab/bc-study/schema'; console.log(await db.select().from(reference).limit(1)); console.log(await db.select().from(referenceSection).limit(1));"` -- both should return rows.
- [ ] Verify AIM resolver state: read [libs/sources/src/aim/resolver.ts](../../../libs/sources/src/aim/resolver.ts). If `getLiveUrl` is the bootstrap default, surface a follow-on WP and STOP -- this WP cannot ship without AIM links resolving.
- [ ] Confirm `git status --porcelain` clean before starting.

## Implementation

### 1. Data model: airboss_ref column + target type enum expand

- [ ] Add `airbossRef: text('airboss_ref').notNull()` to [reference_section schema](../../../libs/bc/study/src/schema.ts) with the CHECK constraint and unique index per [design.md](design.md#schema).
- [ ] Add `REFERENCE_SECTION: 'reference_section'` to `CITATION_TARGET_TYPES` in [libs/constants/src/citations.ts](../../../libs/constants/src/citations.ts) (or wherever it lives -- grep first). Keep `REGULATION_NODE` and `AC_REFERENCE` for now; expand the CHECK constraint to allow all three.
- [ ] Update `CITATION_TARGET_LABELS` to include the new value.
- [ ] Generate the migration: `bun run db generate -- --name=add_airboss_ref_to_reference_section_and_expand_target_types`.
- [ ] Hand-edit the generated SQL to also expand the `content_citation_target_type_check` CHECK constraint.
- [ ] Run `bun run check` -- 0 errors.
- [ ] Commit: "feat(stage-5): add airboss_ref column to reference_section + expand citation target_type enum".

### 2. Backfill seeders + write the migration data move

- [ ] Audit each seeder under `libs/bc/study/src/seeders/` (handbooks / cfr / ac / acs / aim / pcg / ntsb / safo / info / chief-counsel / pts) to populate `airboss_ref` on every `reference_section` insert. Reuse existing URI builders:
  - handbooks: `libs/sources/src/handbooks/ingest.ts:149` (`idForSection`)
  - cfr: `libs/sources/src/regs/normalizer.ts:116`
  - aim: `libs/sources/src/aim/ingest.ts:134`
  - ac, acs: write the URI builder inline in the seeder if no existing helper -- match the format from [design.md](design.md#schema).
- [ ] Add a one-shot data migration that walks every existing row and writes `airboss_ref` per the corpus's URI builder. **Note: dev DB will be reseeded; the migration covers prod**.
- [ ] Run `bun run db reset && bun run db push && bun run db seed` -- verify every reference_section row has a non-null `airboss_ref`.
- [ ] Spot-check three rows by corpus (handbook / cfr / aim) and confirm the URI parses through `parseIdentifier`.
- [ ] Run `bun run check` -- 0 errors.
- [ ] Commit: "feat(stage-5): backfill airboss_ref on reference_section seed".

### 3. URL helper + BC search rewrite

- [ ] Create [libs/sources/src/url-for-reference-section.ts](../../../libs/sources/src/url-for-reference-section.ts) per [design.md](design.md#new-library-helper-urlforreferencesection).
- [ ] Export from `libs/sources/src/index.ts`.
- [ ] Replace `searchRegulationNodes` and `searchAcReferences` in [libs/bc/study/src/citations/search.ts](../../../libs/bc/study/src/citations/search.ts) with a single `searchReferenceSections` per [design.md](design.md#updated-searchreferencesections).
- [ ] Update the citations index export (`libs/bc/study/src/citations/index.ts`) -- drop the two removed functions, add `searchReferenceSections`.
- [ ] Update `libs/bc/study/src/index.ts` parent export to match.
- [ ] Update `verifyTargetExists` in [libs/bc/study/src/citations/citations.ts](../../../libs/bc/study/src/citations/citations.ts) per [design.md](design.md#updated-verifytargetexists). Drop the legacy `regulation_node` / `ac_reference` branches.
- [ ] Add unit tests for `searchReferenceSections` covering: empty query returns first N rows, query matches code, query matches title, query matches reference.documentSlug, limit respected.
- [ ] Run `bun run check` -- 0 errors. Run `bunx vitest run libs/bc/study/src/citations` -- all green.
- [ ] Commit: "feat(stage-5): repoint citation search + verify to study.reference_section".

### 4. resolveCitationTargets enrichment

- [ ] Update `resolveCitationTargets` in [libs/bc/study/src/citations/citations.ts](../../../libs/bc/study/src/citations/citations.ts) per [design.md](design.md#updated-resolvecitationtargets-shape):
  - Add the `reference_section` branch with batched join + URL helper call.
  - Update the knowledge_node branch to populate `href = ROUTES.KNOWLEDGE_NODE(id)`.
  - Drop the legacy `regulation_node` / `ac_reference` branches.
- [ ] Write/update unit tests for `resolveCitationTargets` covering: reference_section with valid section row produces correct label/detail/href; reference_section with missing section row produces `(missing)` detail; knowledge_node populates href; external_ref href untouched.
- [ ] Run `bun run check` -- 0 errors. Run `bunx vitest run libs/bc/study/src/citations` -- all green.
- [ ] Commit: "feat(stage-5): resolveCitationTargets populates href for reference_section + knowledge_node".

### 5. UI: picker tab consolidation + chip render rules

- [ ] Update [CitationPicker.svelte](../../../libs/ui/src/components/CitationPicker.svelte):
  - Remove regulation_node and ac_reference tabs.
  - Add reference_section tab; calls `searchReferenceSections`.
  - Render result rows as `{label}` with a `[corpus]` badge from `detail`.
- [ ] Update [CitationChips.svelte](../../../libs/ui/src/components/CitationChips.svelte) per [design.md](design.md#citationchipssvelte----href--target-rules):
  - Add `targetExternal?: boolean` to `CitationChipItem`.
  - Switch render from blanket `target="_blank"` to per-item rules.
- [ ] Update every consumer of `CitationChipItem` to set `targetExternal` correctly:
  - [apps/study/src/routes/(app)/memory/[id]/_panels/CardCitationsPanel.svelte](../../../apps/study/src/routes/(app)/memory/[id]/_panels/CardCitationsPanel.svelte)
  - [apps/study/src/routes/(app)/reps/[id]/+page.svelte](../../../apps/study/src/routes/(app)/reps/[id]/+page.svelte)
  - [apps/study/src/routes/cards/[id]/+page.svelte](../../../apps/study/src/routes/cards/[id]/+page.svelte) (public card page)
- [ ] Update [composePublicCardCitations](../../../libs/bc/study/src/cards-public.ts):
  - Allow href on `reference_section` and `knowledge_node` targets.
  - Update the policy comment to reflect the new rule.
  - Update its unit tests.
- [ ] Add the flightbag-origin prefix at the chip-render route layer (study `+page.server.ts` files that build CitationChipItem[]). Use `siblingOrigin('flightbag')` from `@ab/utils` if present; else add it.
- [ ] Run `bun run check` -- 0 errors.
- [ ] Commit: "feat(stage-5): citation picker section tab + chip deep-link render".

### 6. Migration 2: retire legacy target type enum values

- [ ] Drop `REGULATION_NODE` and `AC_REFERENCE` from `CITATION_TARGET_TYPES` in `@ab/constants`.
- [ ] Generate migration to contract the CHECK constraint to `('reference_section', 'knowledge_node', 'external_ref')`.
- [ ] Generate the data-move SQL inside the same migration (per [design.md](design.md#migration-2-backfill--retire-legacy-values)). Dev DB has zero matching rows; the migration runs as a no-op there but is correct for prod.
- [ ] Drop `corpusForCitationTarget` legacy branches in [libs/bc/study/src/citations/corpus.ts](../../../libs/bc/study/src/citations/corpus.ts) -- it now switches only on `reference_section` / `knowledge_node` / `external_ref`.
- [ ] Update unit tests in [corpus.test.ts](../../../libs/bc/study/src/citations/corpus.test.ts) accordingly.
- [ ] Update audit findings types in [audit.ts](../../../libs/bc/study/src/citations/audit.ts) -- the audit's resolver-coverage check now reads `reference.kind` from the joined section row.
- [ ] Run `bun run check` -- 0 errors. Run `bunx vitest run libs/bc/study` -- all green.
- [ ] Commit: "feat(stage-5): retire legacy regulation_node + ac_reference citation target types".

### 7. Re-verify + flip scheduled job

- [ ] Manually create three citations in dev (one CFR, one handbook, one external) via the UI. Verify each renders as a clickable chip and clicking navigates to the right place.
- [ ] Run `bun run sources audit-citations` against dev. Treat any findings as a punch list -- close them before continuing.
- [ ] Re-run `bun run sources audit-citations --json` and confirm `findings: []`.
- [ ] Flip `scripts/scheduled-jobs/citation-audit/job.toml` from `enabled = false` to `enabled = true`. Document the flip in the README.
- [ ] Re-install scheduled jobs: `bun run schedule:install`.
- [ ] Run `bun run check` final pass -- 0 errors.
- [ ] Commit: "feat(stage-5): enable citation-audit scheduled job".

### 8. Docs + status

- [ ] Update [docs/ingestion-pipeline/stage-status.md](../../ingestion-pipeline/stage-status.md): stage 5 row goes from "partial" to "complete" for handbooks + CFR + AC + ACS + AIM + the link-only corpora.
- [ ] Update [docs/work/NOW.md](../../work/NOW.md) "Just shipped" with a one-paragraph summary.
- [ ] Spec frontmatter: `status: unread` -> reviewed by user; agent flips `review_status: pending` -> `done` after all tests pass and the manual smoke test in [test-plan.md](test-plan.md) is signed off.

## Post-implementation

- [ ] Full manual test per [test-plan.md](test-plan.md).
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Fix every finding from the review (per project rule -- a review is a punch list, not a menu).
- [ ] Final commit + PR open. PR description summarises the WP scope and links to spec/design/tasks/test-plan.

## Risks + how we close them

- **AIM resolver still default no-op.** Pre-flight task verifies; if true, surface a follow-on WP and gate this WP on it.
- **Section search performance.** Ilike on a 4-column join under ~50k rows is fine. If profiling shows p95 > 200ms, IDEAS.md captures the tsvector follow-on. Out of scope here.
- **Migration runs against a non-empty prod DB.** Dev has zero `regulation_node` / `ac_reference` rows; prod is the same (the picker has been broken since launch). Migration step 2's data-move SQL is a no-op in practice but ships for correctness.
- **siblingOrigin not present.** If `@ab/utils` doesn't already export `siblingOrigin('flightbag')`, add it as part of task group 5. Don't punt.
