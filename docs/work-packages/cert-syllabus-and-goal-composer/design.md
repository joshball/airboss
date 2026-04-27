---
title: 'Design: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: design
status: unread
review_status: pending
---

# Design: Cert, Syllabus, and Goal Composer

Rationale behind the choices in [spec.md](./spec.md). Alternatives are described where a decision was close.

## Scope anchor: ADR 016 phases 1-6 in one WP

ADR 016 defines a 10-phase migration. This WP is phases 1-6:

| Phase | Scope                                                                                | This WP    |
| ----- | ------------------------------------------------------------------------------------ | ---------- |
| 0     | Handbook ingestion + reader                                                          | shipped (WP #1) |
| 1     | Citation table; existing node references migrated                                    | included   |
| 2     | Credential DAG; CERTS / CERT_PREREQUISITES retired into derived views                | included   |
| 3     | Syllabus + SyllabusNode + SyllabusNodeLink + YAML pipeline                           | included   |
| 4     | PPL ACS pilot transcription (Area V); existing 30 nodes wired in                     | included   |
| 5     | Relevance cache rebuild; authored relevance dropped                                  | included   |
| 6     | Goal table; existing study plans converted                                           | included   |
| 7     | Cert dashboard surface (ACS lens)                                                    | data layer only; pages in follow-on |
| 8     | Lens framework + handbook lens + weakness lens                                       | type signatures + ACS + Domain lens; rest follow-on |
| 9     | Personal goal composer                                                               | data layer only; pages in follow-on |
| 10    | Remaining syllabi: IR / CPL / CFI / CFII / MEI / endorsements; IFH + IPH ingested    | ongoing iterative content work |

**Why six phases in one WP rather than six WPs?** Because they compose so tightly that splitting them produces six work packages each blocked on the previous one's data. Citations and references can't ship without credentials and syllabi (the second consumer). Credentials can't be useful without syllabi to attach. Syllabi can't validate without citations resolving. Goals can't compose without syllabi. The relevance cache rebuild can't run without all of the above. Splitting risks shipping schema additions that aren't useful in isolation and accumulating schema-only WPs.

The pages (phases 7, 9) are deliberately split. Page work is bounded SvelteKit + Svelte 5 component work that benefits from a finished BC. Cutting the line between data layer (this WP) and pages (follow-ons) keeps each WP review-able and shippable on its own.

## Five-object model rationale

ADR 016 lays out the model: graph, references, syllabi, credentials, goals. The shape is principles-driven, not codebase-driven (per the user's "right thing should not depend on any of our work" reframe in ADR 016's context). This WP's job is to fit the principles cleanly into the existing schema without compromising either side.

Concretely:

- **Graph** stays as ADR 011 / `knowledge_node` + `knowledge_edge`. No structural changes here -- only the `references` JSONB column reshapes.
- **References** are owned by WP #1 (`reference`, `handbook_section`). This WP composes on top.
- **Citations** are this WP's first new object: a (reference, locator, framing) row. Independent of consumer.
- **Credentials** are this WP's second new object: a DAG of pilot certs / instructor certs / ratings / endorsements. Replaces the constant-table prereqs.
- **Syllabi** are this WP's third new object: a tree projecting onto the graph through `syllabus_node_link`.
- **Goals** are this WP's fourth new object: learner-owned, composing syllabi + ad-hoc nodes.

Five new tables (citation, credential, credential_prereq, credential_syllabus, syllabus, syllabus_node, syllabus_node_link, goal, goal_syllabus, goal_node) feels heavy in one WP. It is. The alternative is six WPs with most schemas, no read paths, and a long tail of half-shipped data shapes the BC has nothing to do with. One WP that lands the model in one shape is the right call.

## Schema rationale

### Why citation as its own table, not as JSONB on each consumer

Same citation gets used many times. A "PHAK Ch 12 §3 (operational framing)" citation is referenced by:

- The `aero-angle-of-attack-and-stall` knowledge node.
- The Area V Task A K1 element of PPL ACS.
- The Area I Task B element of CPL ACS (different leaf, same source).
- The Aerodynamics card on `card.<id>.front`'s footer reference list.

Storing it once and referencing-many is the right shape. Storing it inline as JSONB on each consumer means edits to a citation note (or a typo correction) require finding every consumer that copied it. The JSONB-array-of-citation-ids pattern, with citation rows as the source, gets us:

- Edit-once propagation.
- Cheap reverse queries ("what cites this reference?") via a secondary index on `citation.reference_id`.
- A clean audit story for citation provenance (who created this citation and when).

The cost is one extra join per consumer read. Acceptable -- the consumers (knowledge node detail page, syllabus node detail page) already join several tables; one more is not a perf concern.

### Why locator_data is JSONB and not normalized columns

Locator shape is per-reference-kind. A handbook citation needs `(chapter, section, subsection, page_start, page_end)`. A CFR citation needs `(title, part, section)`. An ACS citation needs `(area, task, element)`. An AIM citation needs `(paragraph)`. Trying to normalize every locator into a single columnar schema produces either:

- A wide table where 80% of columns are NULL on every row.
- A polymorphic table per kind (one for handbook locators, one for CFR locators, etc.), and now the citation table is split into 8 tables that need a discriminated-union read path.

JSONB with a `locator_kind` discriminator is the right primitive. The shape is checked at the BC layer (Zod schema per kind, narrow on `locator_kind`); the DB-level CHECK is just `locator_kind IN (closed enum)`. This matches how `knowledge_node.references` already worked (and how WP #1 left it) -- we're keeping the pattern consistent.

### Why a separate `credential_prereq` table and not a self-joined column

`credential_prereq` is a many-to-many edge: CFII requires CFI AND IR. A self-FK column on `credential` (`prereq_id text`) only models one edge per credential. Storing prereqs as JSONB array of credential_ids on `credential` is closer but loses the per-edge metadata (`kind: required | recommended`, `notes`). The separate table is the natural shape.

### Why `credential_prereq.kind` is required vs recommended, not just a boolean

Some prereqs are FAA-required (you must hold private before commercial). Some are practice-recommended (you should have completed an aerobatic course before solo aerobatics, but it's not a CFR requirement). The two cases want to render differently on the cert dashboard. A `kind` field with a closed enum gives us room to add more (`prerequisite-by-knowledge`, `prerequisite-by-experience`, etc.) without a schema change.

### Why `credential.regulatory_basis` is JSONB array of citation_ids vs a single `cfr_section` field

Some credentials are defined across multiple CFR sections. Multi-engine class rating is partly 14 CFR 61.63 (rating requirements) and partly 14 CFR 61.31 (additional category endorsements). A single field collapses that. An array of citation_ids handles every case; cheap to render as a list on the credential detail page.

### Why `syllabus_node.code` is a single text column vs `(area_code, task_code, element_code)` columns

Same reason WP #1 went with `handbook_section.code`:

1. One column for unique constraints (`(syllabus_id, code)` UNIQUE is one constraint vs three NULLable columns).
2. Clean URLs (`/credentials/private/areas/V/tasks/A` maps to `code='V.A'`).
3. Consistent with `handbook_section.code` -- one pattern across syllabus and handbook tree storage.
4. Free-form for non-ACS / non-PTS syllabi (school syllabi, personal syllabi don't need to follow the Roman-numeral / letter / number convention).

The deterministic composition rule is "join the parent's code with the child's local code via `.`" so `V` -> `V.A` -> `V.A.K1` -> `V.A.K1.x` for sub-element sections.

### Why `syllabus_node.is_leaf` is a stored boolean, not derived

Two reasons:

1. **Read pattern.** "All leaves under syllabus X" is a hot query for the lens framework (the rollup needs every leaf). A stored `is_leaf` column with an index makes that a single index scan. Computing leaf-ness on the fly requires a NOT EXISTS subquery per row.
2. **Validation.** The ACS structure says elements are leaves and tasks are not. Storing `is_leaf` as data lets the build validator catch authoring errors ("you authored an element with children, which violates the ACS shape"). The CHECK on `(required_bloom IS NULL OR is_leaf = true)` is part of that.

The seed maintains `is_leaf` correctness: after upserting all rows for a syllabus, it sweeps and recomputes. Cost is one pass per syllabus rebuild; trivial.

### Why a leaf points at a knowledge node with a weight

Two reasons:

1. **Partial coverage.** PPL ACS Area V Task A K1 ("aerodynamics of steep turns") covers parts of `aero-load-factor` and `aero-four-forces`. Neither node is fully exercised by this leaf. A weight expresses the partial relationship, used by the relevance cache and the rollup math.
2. **Mastery weighting.** When the cert dashboard rolls mastery up from leaves, leaves with weight=1.0 contribute fully; leaves with weight=0.5 count half. Lets a syllabus author de-emphasize a leaf's contribution to the rollup without removing it.

Default weight is 1.0. Most leaves stay at the default; weights are a per-leaf authoring affordance.

### Why a partial UNIQUE on `goal.is_primary`

Mirrors the existing partial UNIQUE on `study_plan` (`one active plan per user`). Same shape, same pattern. Drizzle expresses both via `uniqueIndex(...).where(sql\`is_primary = true\`)`.

### Why `goal_syllabus.weight` is `<= 10.0`, not unbounded

Pragmatic. A weight of 10 means "this syllabus is 10x more important than the others"; if the user wants more contrast, they probably want to archive the others, not crank the weight up. Bounding at 10 catches accidental typos (`100` instead of `1`) before they distort the engine's targeting. Adjustable via constant.

## Pipeline rationale

### Why YAML for syllabus authoring vs in-app editing

Syllabi are system content. The PPL ACS is authored once per FAA edition, reviewable by the user (and any future contributors), versioned by git. Endorsement requirements come from CFRs that change rarely. School syllabi might come from a partner school as a YAML import. None of these benefit from an in-app editor, and an in-app editor for ACS transcription would be a side-feature project. YAML in repo, build-into-DB on seed, is the right shape.

Personal syllabi are different -- they're per-user. Those live in the database via the goal composer pages (follow-on WP) which can author personal syllabi as goal-scoped documents. The data model accommodates both -- `kind='personal'` is a closed-enum value -- but personal syllabi are out of scope for this WP's authoring pipeline.

### Why directory-tree YAML vs single-file YAML

PPL ACS is ~600 element leaves expanded across 11 areas. A single YAML file would be 5,000+ lines, slow to render, hard to diff, and not amenable to per-area authoring concurrency. One file per area maps to the FAA's natural unit of organization.

The cost is a top-level `manifest.yaml` plus one file per area. Each area file is 200-600 lines depending on how dense its tasks are. Authoring an area at a sitting is the natural rhythm.

For very small syllabi (a 5-leaf endorsement), the manifest can carry the whole tree inline; the validator handles both shapes.

### Why we don't auto-generate syllabi from the FAA's PDF

Tempting, but no:

1. **The FAA PDFs are not stable.** WP #1's handbook ingestion pipeline already proved this -- outline + section extraction is a reliability project, and ACS PDFs have additional complexity (figures with overlapping text, mixed-column elements, non-uniform K/R/S formatting across editions).
2. **Transcription quality matters.** Each ACS element is a mastery-affecting authoring artifact. Autogenerated text needs human review anyway, and the review cost approaches the transcription cost.
3. **The transcription is bounded human work.** ~600 elements for PPL ACS. A few hundred more across IR, CPL, CFI/CFII PTS, MEI/MEII, and endorsements. The total addressable surface is ~3,000-4,000 leaves across the certs user zero is pursuing. That's a multi-week project, not a multi-year one.

The pilot transcription (Area V) ships the model. The rest is iterative content authoring after merge.

### Why citations are authored inline in the syllabus YAML rather than referenced by ID

The citation IDs are ULIDs created by the build pipeline. Authoring against an ID would require running the build to get the ID, which means the YAML is no longer a pure-text source. Authoring inline `{ reference: phak, locator: { kind: chapter_section, chapter: 5 } }` lets the build pipeline upsert the citation, get its ID, and store it in the syllabus_node row.

The build hash uses `(reference_slug, locator_data, framing, note)` as the dedupe key, so two leaves authoring the same citation produce one citation row.

## Migration rationale

### Why a one-shot reshape of `knowledge_node.references` and not a long compatibility window

Three reasons:

1. **The schema is small.** ~30 nodes today; under 100 by year-end. A migration that touches every row is cheap, fast, and reviewable.
2. **The shape change is meaningful.** The legacy `{ source, detail, note }` shape doesn't carry enough information for any consumer that cares about citations as objects. A compatibility window would mean every consumer reading the column has to handle two shapes for the duration -- forever, since legacy entries on existing nodes don't migrate themselves.
3. **The migration is one-direction.** Once an entry is a citation_id, it stays one. There's no path back to the legacy shape. A flag column gates the migration so re-running is a no-op.

Alternative considered: dual-shape forever (read path narrows on shape per entry). Rejected because every read path becomes branchy, and the citation surface (the cert dashboard, the lens UI) needs structured citations to do its job. Half-migrated nodes would be invisible to those surfaces.

### Why the relevance cache rebuild is a separate phase from the syllabus seed

Three reasons:

1. **Verification.** The user wants to see the diff between the authored relevance and the cache-derived relevance before the cache writes. A separate `--dry-run` phase produces the diff for review. Inline as part of the seed, the user has no place to intervene.
2. **Idempotency boundary.** The seed walks YAML and writes syllabus rows. The cache rebuild walks DB rows and writes JSONB columns on knowledge_node. Distinct concerns; clean separation lets each phase be re-run independently.
3. **Migration sequencing.** The authored YAML `relevance` field gets dropped by a separate one-shot script after the cache is verified equivalent. Couplng the YAML cleanup to the seed pipeline would mean the YAML and the DB are inconsistent during the seed; cleanup as a separate step keeps the consistency story clean.

### Why `study_plan.cert_goals` stays as a derived view rather than getting hard-cut

Risk management. The session engine reads `cert_goals` from `study_plan` in many places (preview, slot allocation, skip filters, candidate pool queries). Hard-cutting all those reads to `goal_syllabus` in one WP means:

- Every engine test fixture changes.
- Every plan-edit form changes (the form writes `cert_goals` directly today).
- Every skip-domain mutation path that touches `study_plan` changes.

That's an engine-shape refactor, not a data-shape refactor. Keep them separable: this WP delivers the data; a follow-on WP cuts the engine over. The derived view bridges the gap.

The cost is one extra read path. The derivation is `getDerivedCertGoals(userId)`: walk the user's primary goal, walk its goal_syllabus rows, return the cert slugs of every credential whose primary syllabus is in that set. Materialized inline at read time; cheap.

### Why we drop the YAML `relevance` field rather than just stop writing to it

Single source of truth. With the cache in place, the YAML field becomes a misleading parallel claim. An author who edits the YAML expects the system to honor it; the system actually reads from the cache. Deleting the field forces the right authoring path: edit the syllabus, not the node.

The git diff is reviewable; the cleanup script writes a manifest of every node and what was removed. User signs off before the script lands.

## Lens framework rationale

### Why ship two lenses, not one

A single lens proves nothing. The shape might generalize from "ACS only" but it might not. Shipping ACS lens + Domain lens forces the framework to handle two genuinely different tree shapes:

- ACS lens: tree from authored syllabus rows. Internal nodes are authored. Leaf depth is uniform.
- Domain lens: tree from graph metadata. Internal nodes are derived from `knowledge_node.domain` plus `cross_domains`. Leaf depth varies (some domains have sub-domains; most don't).

If both fit the same `LensTreeNode` type cleanly, the type generalizes. If they don't, we adjust the type before any follow-on lens lands.

### Why the lens type takes a `Goal | null` and not just a goal id

Anonymous browse: a learner who hasn't created a goal yet should be able to walk PPL ACS Area V or browse by domain. Passing `null` enables that. The lens implementation treats `null` as "no filter; show the whole tree."

### Why lenses don't get DB writes

Lenses are read-only projections. A lens that wrote (e.g., "marking a section read from the lens UI") would couple the lens layer to the consumer surface. Read-only is the right contract; writes go through the relevant BC function (`setReadStatus` on handbooks, `setPrimaryGoal` on goals, etc.).

## Cert dashboard data layer

This WP doesn't ship pages, but it does ship the BC functions the pages will need. The shape of `getCredentialMastery` is critical because it locks down what the dashboard can render.

The rollup is per-area to keep the response small. A naive "every leaf with its mastery" payload for PPL ACS at 600 leaves is a 600-row JSON blob; rolled up to per-area it's 11 rows of `{ areaCode, areaTitle, totalLeaves, masteredLeaves }`. The dashboard page can drill in to per-task / per-element via dedicated calls.

A `byTask` rollup is a follow-on if the page UX needs it. Right now the area-level rollup is the load-bearing one for the cert dashboard's primary view.

## Goal model rationale

### Why goals are user-owned and not user+system

A goal is the learner's intent. Even a goal that aligns 1:1 with a credential's primary syllabus ("I want to get my private") is the learner's articulation, not a system-imposed track. The data shape reflects this: `goal.user_id` is required; `goal_syllabus` rows are user-authored.

A future "system templates" feature -- "start with the standard PPL goal" -- can ship by inserting pre-baked goal rows on user signup. That's a UX affordance, not a model change.

### Why exactly-one-primary

The session engine needs an unambiguous targeting input. Multiple-active goals are a learner concept (parallel tracks) but the engine needs to pick. `is_primary` is the resolution. Switching primary is a one-click affordance in the UI follow-on; the data model supports it cleanly via the partial UNIQUE.

Alternative considered: weighted union across all active goals, no primary. Rejected because the engine's preview rendering ("we're picking from your PPL goal") becomes unclear. A primary makes the explanation crisp.

### Why goals can pin to specific syllabus editions

ADR 016's resolved decision: a new ACS edition is a new syllabus row. Goals reference a specific syllabus_id (which carries an edition). A learner mid-prep can finish on their current edition; new starts default to the latest active edition.

The migration of `study_plan.cert_goals` resolves cert slugs to "the credential's primary syllabus right now" -- which is the latest active edition. No edition pinning at migration time.

## Constants and naming rationale

### Why `CITATION_LOCATOR_KINDS` is a peer to `REFERENCE_KINDS` (not the same)

`REFERENCE_KINDS` (from WP #1) discriminates the source document: handbook, cfr, ac, acs, pts, aim, pcg, ntsb, poh, other.

`CITATION_LOCATOR_KINDS` (this WP) discriminates the locator shape inside the source: chapter_section (for handbooks), cfr_section, acs_task, ac_paragraph, aim_paragraph, pcg_term, page (generic), other.

The kind of source and the shape of the locator inside it are usually 1:1 (a `cfr` reference uses `cfr_section` locators), but not always. The handbook reader's structured citation could use `chapter_section` (the canonical handbook locator) or `page` (just a page reference, no chapter context). Splitting the discriminators lets each evolve independently.

### Why `ACS_TRIAD` is a separate constant rather than a `KNOWLEDGE_TYPES` entry

Two different concerns. `KNOWLEDGE_TYPES` (factual / conceptual / procedural / judgment / perceptual / pedagogical) is the authored knowledge-type label on a knowledge node. `ACS_TRIAD` (knowledge / risk_management / skill) is the FAA's testing categorization on a syllabus leaf.

A leaf's triad and the linked node's knowledge_type are correlated but not identical. A skill (S) leaf often links to a procedural or perceptual node, but it could also link to a conceptual node that the learner has to demonstrate. Keeping them separate avoids overloading either constant.

### Why we keep `CERTS` as a thin shortcut even after credentials land

The existing dashboard column headers, the study-plan wizard, the engine reason codes, and several BC tests reference `CERTS` directly. Cutting all of those over to `getCredentialBySlug()` reads in one WP would balloon scope. Keep `CERTS` as a constant subset (the four cert dashboard targets); deprecate but don't remove. A follow-on cleanup WP collapses the constant once all readers are migrated.

The data answer is `credential` rows. The UI shortcut is `CERTS`. Both coexist; neither is a stub.

## Authoring flow walkthrough

A concrete walk through the authoring pipeline for a new credential + syllabus + leaves:

1. **Author the credential YAML.** `course/credentials/private.yaml`. Fills in slug, kind, title, category, class, regulatory_basis (CFR citation), prereqs, syllabi.
2. **Author the syllabus manifest.** `course/syllabi/ppl-acs-2024-09/manifest.yaml`. Slug, kind, title, edition, source_url, status, credentials reference.
3. **Author area files.** `course/syllabi/ppl-acs-2024-09/areas/V-performance-maneuvers.yaml`. Tree of tasks -> elements with K/R/S triad.
4. **Run the build pipeline.** `bun run db build` walks `course/`:
   - `bun run db seed credentials`: upserts credential rows + prereqs + syllabus links. Topo-sort validates the DAG.
   - `bun run db seed syllabi`: upserts syllabi + syllabus_nodes + syllabus_node_links. Validates levels, codes, citations, knowledge node references.
   - `bun run db build:relevance`: walks every active syllabus, recomputes the cache on knowledge_node.relevance.
5. **User reviews diffs.** `git status` shows YAML changes. The relevance cache report (written to `docs/work/build-reports/relevance-rebuild-<timestamp>.md`) summarizes per-node changes.
6. **Commit.** `git add` per file; commit; PR.

Re-running the pipeline against unchanged YAML is a no-op (every upsert sees a content hash match and skips).

## Component structure

This WP doesn't ship pages, so no Svelte components. The follow-on cert-dashboard and goal-composer-ui WPs will introduce:

- `CredentialCard.svelte` -- one card per credential on the credentials index.
- `CredentialAreaList.svelte` -- area-level rollup with bars.
- `SyllabusTreeNode.svelte` -- recursive component for area / task / element rows.
- `LensView.svelte` -- generic lens renderer that consumes a `LensResult`.
- `GoalCard.svelte`, `GoalSyllabusEditor.svelte`, `GoalNodeEditor.svelte` -- goal composer pieces.

Listed here so the BC shape considers their needs. Each takes the BC's row shapes directly.

## Data flow

```text
Authoring (YAML)        Build pipeline                    DB                                BC                                  Pages (follow-on WPs)
================        ==============                    ==                                ==                                  =====================
course/credentials/     bun run db seed credentials  ->   credential rows                   credentials.ts                      /credentials
                                                          credential_prereq rows            getCredentialBySlug                  /credentials/[slug]
                                                          credential_syllabus rows          getCertsCoveredBy                    /credentials/[slug]/areas/[area]
                                                                                            getCredentialMastery
course/syllabi/         bun run db seed syllabi      ->   syllabus rows                     syllabi.ts
                                                          syllabus_node rows                getSyllabusBySlug
                                                          syllabus_node_link rows           getSyllabusTree
                                                          (citations upserted inline)       getSyllabusLeavesForNode

course/knowledge/                                                                            (Hot path; existing knowledge BC)
  (relevance dropped)   bun run db build:relevance   ->   knowledge_node.relevance cache    knowledge.ts (existing)
                                                                                            (relevance reads unchanged shape)

(Engine reads study_plan
 unchanged in this WP)  bun run db migrate:study-plan-to-goals -> goal rows                 goals.ts                            /goals
                                                                  goal_syllabus rows        getActiveGoals                       /goals/new
                                                                  (cert_goals derives)      getPrimaryGoal                       /goals/[id]
                                                                                            getDerivedCertGoals                  /goals/[id]/edit

                        bun run db migrate:references-to-citations -> citation rows         citations.ts
                                                                       knowledge_node.references = citation_id[]
                                                                                            resolveCitationUrl (extended)
```

The seed phases run in dependency order: references (WP #1) -> citations (this WP, references must exist for FK targets) -> credentials (citations exist for regulatory_basis) -> syllabi (credentials exist for credential_syllabus links) -> goals (empty; user creates in-app) -> relevance cache rebuild.

## Key decisions

### Decision 1: Citation as a separate table from reference

**Question:** is a citation just a reference + locator stored as JSONB on the consumer, or its own row?

**Chosen:** its own row.

**Why:** a citation gets reused. Storing once and pointing many times is the right shape. A separate row also gives us a place to attach `framing` and `note` without polluting the consumer. The reverse query ("everything that cites this reference") is one indexed lookup.

**Cost:** one extra join per consumer read. Worth it.

### Decision 2: ACS K/R/S as separate leaves, not as fields on a single element

**Question:** is each ACS element one row with `(k_text, r_text, s_text)` columns, or three rows (one per triad)?

**Chosen:** three rows. Per ADR 016's resolved decision.

**Why:**

- A learner can be solid on the K elements (book) and weak on the S elements (flying). The system reports the difference.
- Each triad has its own evidence shape: K leaves want cards, R leaves want scenario decisions, S leaves want demonstration evidence. The lens-evidence-gating data shape (`triad` + `assessment_methods`) lives cleanly on the leaf.
- Each triad has its own bloom level expected. K1 might be `understand`; S1 is almost always `apply` or higher.
- Authoring is straightforward: one element entry per triad in the YAML.

**Cost:** ~3x leaves per task. PPL ACS ~200 task-level rows expand to ~600 element-level rows. Acceptable for the model fidelity gain.

### Decision 3: One YAML directory per syllabus, one file per area

**Question:** big-file authoring or directory-tree authoring?

**Chosen:** directory tree.

**Why:** see "Why directory-tree YAML vs single-file YAML" above. Per-area is the natural unit.

**Cost:** more files. Acceptable; matches how `course/knowledge/<slug>/node.md` is already structured (one file per node).

### Decision 4: Drop authored relevance from YAML entirely after the cache rebuild

**Question:** dual-source forever (cache plus authored YAML, where the cache wins), or drop the YAML?

**Chosen:** drop the YAML.

**Why:** see "Why we drop the YAML `relevance` field" above. Dual-source is a drift trap.

**Cost:** one-shot script, one git diff per node, one PR review. Bounded.

### Decision 5: Multiple active goals, one primary

**Question:** strict-one-active, multiple-actives-with-primary, or unlimited-actives?

**Chosen:** multiple actives, one primary.

**Why:** see Open Question 1 in spec.md and the goal model rationale above.

### Decision 6: `study_plan.cert_goals` stays as a derived view

**Question:** hard cutover to engine-reads-from-goal, or keep `cert_goals` as a derived value?

**Chosen:** derived view. Engine refactor is a follow-on WP.

**Why:** see "Why `study_plan.cert_goals` stays as a derived view" above. Risk management.

### Decision 7: Ship Area V transcription in this WP

**Question:** transcribe Area V (~24 leaves) as part of this WP, or land the schema and validator alone?

**Chosen:** ship Area V transcription.

**Why:** the schema is meaningless without one full Area's worth of authored content exercising it. Area V is small (one author-day's worth) and exercises K/R/S triad split end-to-end. Without authored content, the validator and seed pipeline ship without the round-trip evidence that they work on a real syllabus.

**Cost:** ~one author-day of transcription work inside this WP. The remaining 7 areas of PPL ACS, plus all of IR/CPL/CFI/CFII/MEI/MEII, are iterative content sweeps after merge.

## Alternatives considered

| Alternative                                                                  | Why not                                                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A single `learning_object` table polymorphic over reference / citation / node | Conflates four distinct concerns. Loses the per-table CHECK and FK clarity. Harder to write or read.            |
| Citations as JSONB on each consumer (no `study.citation` table)              | Same citation duplicated across consumers; edits drift. See Decision 1.                                          |
| `credential_prereq` as a self-FK column on `credential`                      | Models only one prereq per credential; CFII (CFI + IR) doesn't fit. See Schema rationale.                        |
| `syllabus_node` flat (chapter / section / subsection codes only)             | Loses the area / task / element semantic. Lens framework becomes guesswork.                                       |
| Inline citation authoring via citation_id (auto-generated on first build)    | YAML loses purity; can't author against a citation that doesn't exist yet without first running build.            |
| Single ACS element row per task (K + R + S as columns)                       | Conflates three different mastery dimensions. See Decision 2.                                                    |
| Generate syllabi from FAA PDF                                                | Reliability + quality + scope. See "Why we don't auto-generate" above.                                            |
| Hard cutover: drop `cert_goals` and rewire the engine in this WP             | Engine refactor scope. See Decision 6.                                                                           |
| Single active goal per user, like the single active study plan               | Doesn't model parallel tracks the user actually has. See Decision 5.                                             |
| Derived cache of relevance computed on read (no stored column)               | Hot path through `knowledge_node.relevance` is the dashboard; computing it on every read is wasteful. Cache it.   |
| Dropping `CERTS` constant entirely in this WP                                | Wide blast radius -- many readers reference it. Deprecate, plan removal in follow-on. See Constants rationale.    |
| Lens type tied to ACS shape only                                             | Doesn't generalize. Two lenses ship to prove the type. See Lens framework rationale.                             |
| Materialized view for `cert_goals` derivation                                | Postgres materialized views need explicit REFRESH; adds a maintenance burden. BC-layer derivation is cheap enough. |

## Observability

- Build pipeline emits a JSON summary per phase: `{ phase, rowsRead, rowsUpserted, rowsSkipped, validationErrors, validationWarnings }`. Written to `docs/work/build-reports/<phase>-<timestamp>.md` so re-runs leave a traceable history.
- Relevance cache rebuild emits a per-node diff manifest (`+ added: ppl@apply`, `- removed: cfi@evaluate`, `~ promoted: ppl@remember -> ppl@understand`). Reviewable by `git diff` and by reading the manifest.
- BC functions log structured errors via the existing logging path; no new infra.
- The cert dashboard rollup (`getCredentialMastery`) is indexed; a slow-query log entry would surface a missing index. Indexes ship with the migration.

## Security + permissions

- Reading credentials, syllabi, and citations is auth-required (everything under `(app)`). The data is not user-specific at the credential / syllabus / citation level; it's system content.
- Goals are per-user. `goals.ts` BC functions enforce `goal.user_id = currentUser.id` on every read and write.
- Knowledge node updates that the relevance cache rebuilds against are read-only at runtime; the rebuild runs in dev / build context, gated by `scripts/db/seed-guard.ts` for production safety.
- The schema migration runs as part of the standard drizzle pipeline; no special privileges.
- No PII in the new tables. Goals carry `notes_md` which could include PII; that's per-user and never exposed cross-user.
