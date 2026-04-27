---
title: 'Spec: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: spec
status: unread
review_status: pending
---

# Spec: Cert, Syllabus, and Goal Composer

The second phase of [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md): the data layer that turns the knowledge graph into a multi-cert, multi-syllabus, multi-goal learning model. Builds the `citation`, `credential`, `credential_prereq`, `credential_syllabus`, `syllabus`, `syllabus_node`, `syllabus_node_link`, `goal`, `goal_syllabus`, and `goal_node` tables; composes on top of the `reference` and `handbook_section` tables shipped by [handbook-ingestion-and-reader](../handbook-ingestion-and-reader/spec.md); and converts the per-node `relevance` array from authored YAML to a derived cache.

Ships ADR 016 phases 1, 2, 3, 4, 5, and 6. Phases 7-9 (cert dashboard pages, lens framework UI, personal goal composer pages) are out of scope here -- their data layers and BC functions land here, but the SvelteKit page work is a follow-on WP.

## Why this WP exists

The handbook reader gave the learner a place to read FAA wording. This WP gives the learner a place to **target it**:

- **A returning CFI rebuilding seven credentials** does not have a single-cert study plan. He has a goal. Today the engine targets `study_plan.cert_goals: ['private', 'instrument', 'commercial', 'cfi']`, treats them as a flat union, and loses the structure of each cert's ACS / PTS. ADR 016 phase 6 fixes this by introducing the `goal` object.
- **Per-node relevance arrays drift.** `course/knowledge/<slug>/node.md` carries `minimum_cert: private` plus an authored `relevance` array. With many nodes and many syllabi pointing at them at different bloom levels, the array becomes the wrong place to author the assertion. ADR 016 phase 5 makes it a derived cache.
- **`CERT_PREREQUISITES` is a line, not a DAG.** CFII is CFI + IR add-on. MEI is CFI + multi-engine. Endorsements are peers. The constant table in `libs/constants/src/study.ts` collapses all of that to `PPL -> IR / CPL -> CFI`. ADR 016 phase 2 puts the DAG in the database as data.
- **The ACS structure has nowhere to live.** ACS Areas of Operation -> Tasks -> Elements (K/R/S triad) is the spine the FAA writes against and examiners test against. The graph carries no syllabus structure today. ADR 016 phase 3 creates the `syllabus` + `syllabus_node` tree and ADR 016 phase 4 transcribes a pilot subset of PPL ACS into it.

This WP is the data substrate. Cert dashboard pages, lens UI, and goal composer pages compose on top in follow-ons.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md). Migration plan rows for phases 1-6 are this WP's contract.
- [ADR 016 context](../../decisions/016-cert-syllabus-goal-model/context.md) -- why the five-object model.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), especially principles 2 (cert as constraint set), 3 (DAG composition), 4 (goal vs course), 5 (mastery rollups), 6 (lenses), 9 (evidence matches knowledge type).
- [ADR 011 -- Knowledge graph + learning system](../../decisions/011-knowledge-graph-learning-system/decision.md). The graph this WP projects onto.
- [Handbook Ingestion and Reader spec](../handbook-ingestion-and-reader/spec.md). The `reference`, `handbook_section`, `handbook_figure`, and `handbook_read_state` tables; the discriminated-union `Citation` shape on `knowledge_node.references`; the `resolveCitationUrl` resolver this WP extends.
- [Handbook Ingestion and Reader design](../handbook-ingestion-and-reader/design.md). Storage rationale (committed markdown + DB seed), schema rationale (separate tables for distinct lifecycles), citation-upgrade rationale (discriminated union on JSONB).
- Existing constants this WP retires or repurposes: `CERTS`, `CERT_PREREQUISITES`, `CERT_VALUES`, `CERT_LABELS` in `libs/constants/src/study.ts`; `CERT_APPLICABILITIES` in `libs/constants/src/reference-tags.ts`.

## In Scope

1. **Citation table.** New `study.citation` row that pairs a `reference_id` with a structured `locator`, a `framing`, and an optional `note`. Independent of where it's used; pointed at via `citation_id` arrays in JSONB on `knowledge_node`, `syllabus_node`, and per-consumer joins where the relationship is stable.
2. **Migration of `knowledge_node.references` to citations.** Existing freeform `{ source, detail, note }[]` entries become `citation` rows with `kind=other` and the original text in `locator_data.text`. Existing structured handbook citations (from the WP #1 schema-only upgrade) become rows with `kind=handbook` and the locator copied verbatim. The JSONB column on `knowledge_node` becomes an array of `citation_id` strings.
3. **Citation URL resolver extension.** `resolveCitationUrl(citation, references, handbookSections?)` is extended to handle every reference kind: handbook (delegates to WP #1's resolver), CFR (links eCFR), AC (links FAA AC index), ACS / PTS (links the FAA test-standards page), AIM (links AIM by paragraph), Pilot/Controller Glossary (links PCG by term), NTSB / POH / other (returns `null`; UI renders the freeform note).
4. **Credential DAG.** New `study.credential`, `study.credential_prereq`, and `study.credential_syllabus` tables. Seeded with every credential user zero is pursuing: private, commercial, atp (the third pilot cert tier the model needs to support), instrument, multi-engine-land, single-engine-land, single-engine-sea, multi-engine-sea, cfi, cfii, mei, meii (multi-instrument-instructor), and the common 14 CFR 61.31 endorsements (complex, high-performance, tailwheel, high-altitude, spin, glass cockpit). Plus `category` and `class` fields per ADR 016.
5. **Retire `CERT_PREREQUISITES` constant.** Replaced by data in `credential_prereq`. The constant becomes a derived helper `getCertsCoveredBy(credentialId)` that walks the DAG; the existing `CERTS` / `CERT_VALUES` / `CERT_LABELS` constants are kept as a slim authoring shortcut (the four-cert subset the existing study-plan dashboard targets) but route through the DB credential rows for source-of-truth purposes.
6. **Syllabus tables.** New `study.syllabus`, `study.syllabus_node`, and `study.syllabus_node_link` tables. Tree-shaped `syllabus_node` with `parent_id` self-FK, `level` enum (area / task / element / section), `code` deterministic citation code (`I.A.K1`), and `triad` field (knowledge / risk_management / skill / null) for ACS K/R/S split (per ADR 016's resolved decision: separate leaves for each triad element). Plus authored `required_bloom`, `description`, and `citations` JSONB array of `citation_id`.
7. **YAML authoring pipeline for syllabi.** `course/syllabi/<slug>/...` directory tree (one YAML file per Area; see Open Question 2) authored as system content, built into the DB via `bun run db seed syllabi`. Idempotent, content-hashed, no rebuild on unchanged files. Validator rejects level-hierarchy violations, dangling `knowledge_node_link` targets, duplicate codes within a syllabus, and parent-child cycles.
8. **PPL ACS pilot transcription -- Area V "Performance Maneuvers".** Three tasks (Steep Turns; Steep Spirals; Chandelles or whatever Area V's third task is in the current edition), expanded to ~24 K/R/S element leaves, transcribed into the YAML schema as the model-validation pilot. Existing 30 knowledge nodes get `syllabus_node_link` rows authored against the relevant Area V leaves where applicable. Full PPL ACS transcription is iterative human work after this WP merges; the WP ships the schema, validator, seed pipeline, linking guidance, and one Area's worth of authored content.
9. **Relevance cache rebuild.** Build script walks every active syllabus; per linked `knowledge_node`, accumulates `(cert, bloom, priority)` triples from the syllabus's credential and the leaf's `required_bloom`; deduplicates; writes to `knowledge_node.relevance` (existing JSONB column) as a cache. The authored YAML `relevance` field is dropped from frontmatter via a one-shot script after the syllabi-driven cache is verified equivalent.
10. **Goal table and goal-aware engine handoff.** New `study.goal`, `study.goal_syllabus`, and `study.goal_node` tables. Existing `study_plan.cert_goals` array converts to `goal` + `goal_syllabus` rows via a one-shot migration. `study_plan` table stays (the engine targeting state); `cert_goals` becomes a derived view computed from the active goal (Open Question 4). The session engine continues to read `study_plan` directly during this WP; a follow-on WP cuts the engine over to read goal-derived filters.
11. **BC functions.** `libs/bc/study/src/citations.ts`, `credentials.ts`, `syllabi.ts`, `goals.ts`, plus extensions to `handbooks.ts` for the resolver. Mastery rollup at the cert / area / task / element level lives in `credentials.ts` so the cert dashboard follow-on has the substrate it needs. Lens framework type signature lives in `lenses.ts` with two lens implementations (ACS lens, Domain lens); other lenses are typed but not implemented here.
12. **Constants and routes.** New `CITATION_LOCATOR_KINDS`, `CITATION_FRAMINGS`, `CREDENTIAL_KINDS`, `CREDENTIAL_PREREQ_KINDS`, `CREDENTIAL_CATEGORIES`, `CREDENTIAL_CLASSES`, `SYLLABUS_KINDS`, `SYLLABUS_PRIMACY`, `SYLLABUS_NODE_LEVELS`, `ACS_TRIAD`, `LENS_KINDS`, `GOAL_STATUSES` plus values arrays and labels. Route entries for `/credentials`, `/credentials/[slug]`, `/credentials/[slug]/areas/[area]`, `/goals`, `/goals/new`, `/goals/[id]`, `/goals/[id]/edit` (definitions only -- pages land in follow-on WPs).

## Out of Scope (explicit)

- **Cert dashboard page rendering.** Routes are defined and BC functions land here; `+page.svelte` work is a follow-on WP (`cert-dashboard`).
- **Personal goal composer page rendering.** Routes are defined and BC functions land here; `+page.svelte` work is a follow-on WP (`goal-composer-ui`).
- **Lens framework UI for non-ACS / non-Domain lenses.** Type signatures land here for handbook, weakness, bloom, phase-of-flight, and custom lenses; their implementations are follow-on WPs once the cert-dashboard page work proves the lens primitives.
- **Mastery evidence-kind gating.** ADR 016 says "S leaf needs scenario evidence; K leaf needs card evidence." This WP records the data shape (`triad`, `assessment_methods`) so the rule can be enforced; the actual engine wiring that surfaces only matching evidence kinds per leaf is a follow-on (`lens-evidence-gating`).
- **Full ACS / PTS / endorsement transcription beyond the Area V pilot.** Iterative human content work after merge -- ADR 016 phase 10. The WP ships the YAML schema and validator; full PPL/IR/CPL/CFI/CFII/MEI/MEII content lands incrementally.
- **ACS edition diff surface.** When the FAA publishes a new ACS, a new `syllabus` row is inserted (resolved decision in ADR 016). A diff viewer that shows what changed (added / removed / renamed leaves) is spec'd lightly here as design future work but full implementation waits until a real second edition publishes.
- **Multi-tenant goal sharing.** Goals are per-user. Sharing is a future feature requiring auth + ACL design.
- **The `study_plan` cutover to read from goals.** Stays for backwards compatibility; a follow-on WP migrates the session engine to read goal-derived filters and removes the `cert_goals` column.

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Authoring (YAML in repo)                                               │
│   course/knowledge/<slug>/node.md          (existing; relevance dropped)│
│   course/syllabi/<slug>/areas/...yaml      (NEW; this WP)               │
│   handbooks/<doc>/<edition>/...md          (from WP #1)                 │
│       |                                                                 │
│       v                                                                 │
│  Build pipeline                                                         │
│   bun run db seed syllabi                  -> syllabus, syllabus_node,  │
│                                                syllabus_node_link rows  │
│   bun run db seed credentials              -> credential, credential_*  │
│   bun run db build:relevance               -> rebuild cache on          │
│                                                knowledge_node.relevance │
│       |                                                                 │
│       v                                                                 │
│  DB (study schema)                                                      │
│   reference (WP #1)                                                     │
│   handbook_section (WP #1)                                              │
│   citation (NEW)                                                        │
│   credential (NEW), credential_prereq (NEW), credential_syllabus (NEW)  │
│   syllabus (NEW), syllabus_node (NEW), syllabus_node_link (NEW)         │
│   knowledge_node (existing; references column reshaped)                 │
│   goal (NEW), goal_syllabus (NEW), goal_node (NEW)                      │
│   study_plan (existing; cert_goals stays for now)                       │
│       |                                                                 │
│       v                                                                 │
│  BC (libs/bc/study/src/)                                                │
│   citations.ts        list / get / resolveCitationUrl extensions        │
│   credentials.ts      DAG walks, mastery rollup at cred/area/task/elt   │
│   syllabi.ts          tree walks, leaf links, citation lookup           │
│   goals.ts            CRUD, active-goal resolution, weighted union      │
│   lenses.ts           Lens type + ACS lens + Domain lens                │
│   handbooks.ts        resolveCitationUrl extended to all kinds          │
│       |                                                                 │
│       v                                                                 │
│  Routes (defined; pages in follow-on WPs)                               │
│   /credentials, /credentials/[slug], /credentials/[slug]/areas/[area]   │
│   /goals, /goals/new, /goals/[id], /goals/[id]/edit                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Model

All tables in the `study` Postgres schema namespace. IDs use `prefix_ULID` via `@ab/utils createId()`. Drizzle ORM. CHECK constraints follow the existing `inList(...)` pattern.

### study.citation

Pairs a `reference_id` with a typed locator, framing, and optional note. Independent of where it's used; many things may carry the same citation. Citations live once, get referenced many times.

| Column        | Type        | Constraints                                              | Notes                                                                                              |
| ------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id            | text        | PK                                                       | `cit_` prefix.                                                                                     |
| reference_id  | text        | NOT NULL, FK `study.reference.id` ON DELETE RESTRICT     | Restrict so deleting a reference with citations is loud, not silent.                               |
| locator_kind  | text        | NOT NULL, CHECK in `CITATION_LOCATOR_KIND_VALUES`        | chapter_section / cfr_section / acs_task / ac_paragraph / aim_paragraph / pcg_term / page / other. |
| locator_data  | jsonb       | NOT NULL                                                 | Typed by `locator_kind`. Discriminated-union shape (see below).                                    |
| framing       | text        | NOT NULL, CHECK in `CITATION_FRAMING_VALUES`             | survey / operational / procedural / regulatory / examiner.                                         |
| note          | text        | NULL                                                     | Optional learner-facing context.                                                                   |
| seed_origin   | text        | NULL                                                     | Standard project-wide dev-seed marker. NULL on production rows.                                    |
| created_at    | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |
| updated_at    | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |

Indexes: `(reference_id)` for "all citations against this reference"; `(locator_kind)` for kind-filtered listings.

`locator_data` is a discriminated union. The `locator_kind` column is the discriminator; the JSONB shape narrows accordingly:

```typescript
// libs/types/src/citation.ts (extends WP #1's discriminated union)
export type CitationLocatorData =
	| { kind: 'chapter_section'; chapter: number; section?: number; subsection?: number; page_start?: string; page_end?: string }
	| { kind: 'cfr_section'; title: number; part: number; section: string }
	| { kind: 'acs_task'; area?: string; task?: string; element?: string }
	| { kind: 'ac_paragraph'; paragraph?: string }
	| { kind: 'aim_paragraph'; paragraph?: string }
	| { kind: 'pcg_term'; term: string }
	| { kind: 'page'; page: string }
	| { kind: 'other'; text: string };
```

The `kind` discriminator on `locator_data` matches the column's `locator_kind` value. The build script enforces this in validation.

### study.credential

Umbrella table for pilot certs, instructor certs, ratings, and endorsements.

| Column            | Type        | Constraints                                                | Notes                                                                                              |
| ----------------- | ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id                | text        | PK                                                         | `cred_` prefix.                                                                                    |
| kind              | text        | NOT NULL, CHECK in `CREDENTIAL_KIND_VALUES`                | pilot_cert / instructor_cert / rating / endorsement.                                               |
| slug              | text        | NOT NULL, UNIQUE                                           | `private`, `commercial`, `atp`, `instrument`, `single-engine-land`, `multi-engine-land`, `cfi`, `cfii`, `mei`, `meii`, `complex`, `high-performance`, `tailwheel`, `high-altitude`, `spin`, etc. |
| title             | text        | NOT NULL                                                   | "Private Pilot Certificate"; "Multi-Engine Land Class Rating"; "Complex Endorsement (61.31(e))".   |
| category          | text        | NOT NULL, CHECK in `CREDENTIAL_CATEGORY_VALUES`            | airplane / rotorcraft / glider / balloon / powered-lift / none. `none` for cross-category creds and most endorsements. |
| class             | text        | NULL, CHECK in `CREDENTIAL_CLASS_VALUES`                   | single-engine-land / multi-engine-land / single-engine-sea / multi-engine-sea / null (N/A).        |
| regulatory_basis  | jsonb       | NOT NULL, DEFAULT '[]'                                     | Array of `citation_id` strings pointing at the CFR sections that define this credential (e.g. `["cit_..."]` resolving to 14 CFR 61.103 for private). |
| status            | text        | NOT NULL, DEFAULT 'active', CHECK in `CREDENTIAL_STATUS_VALUES` | active / archived. Archived = retired by FAA or replaced.                                       |
| seed_origin       | text        | NULL                                                       |                                                                                                    |
| created_at        | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |
| updated_at        | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |

Indexes: `(kind)`, `(category, class)`, `(status)`. `slug` UNIQUE.

### study.credential_prereq

Prerequisite DAG. `(credential_id, prereq_id)` composite PK. Cycles forbidden -- enforced at seed time by topological sort.

| Column         | Type        | Constraints                                                  | Notes                                                                |
| -------------- | ----------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| credential_id  | text        | NOT NULL, FK `study.credential.id` ON DELETE CASCADE         |                                                                      |
| prereq_id      | text        | NOT NULL, FK `study.credential.id` ON DELETE RESTRICT        | Restrict so a referenced prereq can't be silently deleted.           |
| kind           | text        | NOT NULL, DEFAULT 'required', CHECK in `CREDENTIAL_PREREQ_KIND_VALUES` | required / recommended.                                       |
| notes          | text        | NULL                                                         |                                                                      |
| seed_origin    | text        | NULL                                                         |                                                                      |
| created_at     | timestamptz | NOT NULL, DEFAULT now()                                      |                                                                      |

Composite PK `(credential_id, prereq_id, kind)`. Index `(prereq_id)` for reverse-lookup.

### study.credential_syllabus

Maps a credential to its primary and alternate syllabi.

| Column         | Type        | Constraints                                                | Notes                                                                                              |
| -------------- | ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| credential_id  | text        | NOT NULL, FK `study.credential.id` ON DELETE CASCADE       |                                                                                                    |
| syllabus_id    | text        | NOT NULL, FK `study.syllabus.id` ON DELETE RESTRICT        | Restrict; deleting a referenced syllabus must be explicit.                                         |
| primacy        | text        | NOT NULL, DEFAULT 'primary', CHECK in `SYLLABUS_PRIMACY_VALUES` | primary / alternate. The FAA's ACS is primary; a school's syllabus is alternate.               |
| seed_origin    | text        | NULL                                                       |                                                                                                    |
| created_at     | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |

Composite PK `(credential_id, syllabus_id)`. Partial UNIQUE: `(credential_id) WHERE primacy = 'primary'` -- a credential has at most one primary syllabus.

### study.syllabus

Authored projection onto the knowledge graph. ACS, PTS, 14 CFR 61.31 endorsement requirements, school syllabi, personal curricula -- all the same shape.

| Column                 | Type        | Constraints                                              | Notes                                                                                              |
| ---------------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id                     | text        | PK                                                       | `syl_` prefix.                                                                                     |
| slug                   | text        | NOT NULL                                                 | `ppl-acs-2024-09`, `cfi-pts-2024`, `complex-endorsement-61-31-e`, `personal-cfi-rebuild`. Edition baked in for FAA syllabi (a new edition is a new row, not an edit). |
| kind                   | text        | NOT NULL, CHECK in `SYLLABUS_KIND_VALUES`                | acs / pts / endorsement / school / personal.                                                       |
| title                  | text        | NOT NULL                                                 | "Private Pilot Airplane ACS"; "Complex Endorsement -- 14 CFR 61.31(e)".                            |
| edition                | text        | NOT NULL                                                 | `FAA-S-ACS-6B`, `FAA-S-ACS-15`, `2024-09`, etc. Free-form per kind.                                |
| edition_published_at   | date        | NULL                                                     | When the FAA published this edition (or the personal syllabus was last edited).                    |
| source_url             | text        | NULL                                                     | Official FAA URL when applicable.                                                                  |
| status                 | text        | NOT NULL, DEFAULT 'draft', CHECK in `SYLLABUS_STATUS_VALUES` | draft / active / archived.                                                                     |
| seed_origin            | text        | NULL                                                     |                                                                                                    |
| created_at             | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |
| updated_at             | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |

Unique: `(slug)` and `(kind, edition)` for FAA syllabi (a kind+edition pair is one canonical syllabus). Indexes: `(status)`, `(kind)`.

### study.syllabus_node

The tree. Areas at the top, then Tasks, then Elements (ACS triad split: separate leaves for K, R, S each), then optional sub-element Sections.

| Column          | Type        | Constraints                                                | Notes                                                                                              |
| --------------- | ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id              | text        | PK                                                         | `sln_` prefix.                                                                                     |
| syllabus_id     | text        | NOT NULL, FK `study.syllabus.id` ON DELETE CASCADE         |                                                                                                    |
| parent_id       | text        | NULL, FK `study.syllabus_node.id` ON DELETE CASCADE        | NULL for area rows; the area for tasks; the task for elements; the element for subsection rows.    |
| ordinal         | integer     | NOT NULL                                                   | Stable within-parent sort order.                                                                   |
| level           | text        | NOT NULL, CHECK in `SYLLABUS_NODE_LEVEL_VALUES`            | area / task / element / section.                                                                   |
| code            | text        | NOT NULL                                                   | Citation code: `I`, `I.A`, `I.A.K1`, `I.A.S2`. ACS / PTS conventions; free-form for non-ACS.       |
| title           | text        | NOT NULL                                                   |                                                                                                    |
| description     | text        | NULL                                                       | Optional prose. Often the verbatim ACS element text.                                               |
| triad           | text        | NULL, CHECK in `ACS_TRIAD_VALUES`                          | knowledge / risk_management / skill / null. Set only when `level='element'` for ACS / PTS syllabi. |
| required_bloom  | text        | NULL, CHECK in `BLOOM_LEVEL_VALUES`                        | The bloom level expected at this leaf. NULL for non-leaf rows. Drives derived `relevance` cache.   |
| citations       | jsonb       | NOT NULL, DEFAULT '[]'                                     | Array of `citation_id` strings. Same shape `knowledge_node.references` is migrating to.            |
| is_leaf         | boolean     | NOT NULL                                                   | True when this row has no children. Maintained by the seed.                                        |
| seed_origin     | text        | NULL                                                       |                                                                                                    |
| created_at      | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |
| updated_at      | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |

Unique: `(syllabus_id, code)`. Indexes: `(syllabus_id, parent_id, ordinal)` for tree walks; `(syllabus_id, level, ordinal)` for level-filtered listings; `(syllabus_id, is_leaf)` for "all leaves" queries.

CHECK consistency:

- `level='area'` requires `parent_id IS NULL`.
- `level IN ('task','element','section')` requires `parent_id IS NOT NULL`.
- `triad IS NOT NULL` only when `level='element'`.
- `required_bloom IS NOT NULL` only when `is_leaf=true`.

Expressed as a single CHECK using `sql.raw()`:

```sql
(("level" = 'area' AND "parent_id" IS NULL)
 OR ("level" IN ('task','element','section') AND "parent_id" IS NOT NULL))
AND ("triad" IS NULL OR "level" = 'element')
AND ("required_bloom" IS NULL OR "is_leaf" = true)
```

### study.syllabus_node_link

Many-to-many edge from a leaf `syllabus_node` to a `knowledge_node`. One leaf can link to many nodes (a task often spans several concepts); one node can be linked from many leaves (the same node is on several certs at different bloom levels).

| Column              | Type        | Constraints                                                | Notes                                                                                              |
| ------------------- | ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id                  | text        | PK                                                         | `snl_` prefix.                                                                                     |
| syllabus_node_id    | text        | NOT NULL, FK `study.syllabus_node.id` ON DELETE CASCADE    | Must point at a leaf row -- enforced by seed (BC layer). DB CHECK can't express "is_leaf=true on the referenced row." |
| knowledge_node_id   | text        | NOT NULL, FK `study.knowledge_node.id` ON DELETE CASCADE   |                                                                                                    |
| weight              | real        | NOT NULL, DEFAULT 1.0                                      | For partial coverage (this leaf only partly covers the node).                                      |
| notes               | text        | NULL                                                       |                                                                                                    |
| seed_origin         | text        | NULL                                                       |                                                                                                    |
| created_at          | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |

Unique: `(syllabus_node_id, knowledge_node_id)`. Indexes: `(knowledge_node_id, syllabus_node_id)` for reverse-lookup ("which leaves point at this node"); `(syllabus_node_id)` for forward.

### study.goal

Learner-owned. References zero or more syllabi (with weights and optional sequencing) plus ad-hoc graph nodes. Goals can be cert-agnostic (BFR prep, "stay sharp") or multi-cert.

| Column          | Type        | Constraints                                              | Notes                                                                                              |
| --------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id              | text        | PK                                                       | `goal_` prefix.                                                                                    |
| user_id         | text        | NOT NULL, FK `bauth_user.id` ON DELETE CASCADE           |                                                                                                    |
| title           | text        | NOT NULL                                                 |                                                                                                    |
| status          | text        | NOT NULL, DEFAULT 'active', CHECK in `GOAL_STATUS_VALUES` | active / paused / archived.                                                                       |
| is_primary      | boolean     | NOT NULL, DEFAULT false                                  | Resolves Open Question 1: multiple active allowed; exactly one is `is_primary` per user. Drives the session engine targeting. |
| notes_md        | text        | NOT NULL, DEFAULT ''                                     | User's free-form markdown notes about the goal.                                                    |
| seed_origin     | text        | NULL                                                     |                                                                                                    |
| created_at      | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |
| updated_at      | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |

Indexes: `(user_id, status)`. Partial UNIQUE: `(user_id) WHERE is_primary = true` -- enforces at-most-one-primary-goal per user.

### study.goal_syllabus

Which syllabi a goal includes, with weight and optional sequencing.

| Column         | Type        | Constraints                                              | Notes                                                                                              |
| -------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| goal_id        | text        | NOT NULL, FK `study.goal.id` ON DELETE CASCADE           |                                                                                                    |
| syllabus_id    | text        | NOT NULL, FK `study.syllabus.id` ON DELETE RESTRICT      | Restrict so a referenced syllabus can't be silently deleted.                                       |
| weight         | real        | NOT NULL, DEFAULT 1.0                                    | Relative emphasis across goal syllabi.                                                             |
| sequence_hint  | integer     | NULL                                                     | Optional ordering hint (lower = study first). Advisory, not a hard gate.                           |
| focus_filter   | jsonb       | NULL                                                     | Subset of areas / tasks the user cares about within this syllabus. Shape: `{ areaCodes?: string[]; taskCodes?: string[]; elementCodes?: string[] }`. |
| seed_origin    | text        | NULL                                                     |                                                                                                    |
| created_at     | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                                    |

Composite PK `(goal_id, syllabus_id)`. Index `(syllabus_id)` for "which goals include this syllabus."

### study.goal_node

Ad-hoc knowledge nodes a goal includes outside any syllabus (weak areas, personal interest, BFR currency items).

| Column              | Type        | Constraints                                                | Notes                                                                                              |
| ------------------- | ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| goal_id             | text        | NOT NULL, FK `study.goal.id` ON DELETE CASCADE             |                                                                                                    |
| knowledge_node_id   | text        | NOT NULL, FK `study.knowledge_node.id` ON DELETE CASCADE   |                                                                                                    |
| reason              | text        | NULL                                                       | "weak area"; "personal interest"; "checkride hot topic". Free-form.                                |
| seed_origin         | text        | NULL                                                       |                                                                                                    |
| created_at          | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                    |

Composite PK `(goal_id, knowledge_node_id)`. Index `(knowledge_node_id)`.

### Reshape of `knowledge_node.references`

The existing JSONB column changes shape from `{ source, detail, note }[]` (legacy freeform) and the WP #1 discriminated-union schema to a uniform `string[]` of `citation_id` values that point at `study.citation` rows. Migration is one-way; the legacy and structured-but-inline shapes are both rewritten into citation rows + an array of IDs.

```typescript
// Before (legacy):
{ source: 'PHAK (FAA-H-8083-25C)', detail: 'Ch 12 §3', note: 'AOA definition' }

// Before (WP #1 structured-on-array):
{ kind: 'handbook', reference_id: 'ref_phak_8083_25c', locator: { chapter: 12, section: 3 } }

// After (this WP):
'cit_01J...'  // points at a row in study.citation
```

The migration script is part of this WP. It runs once during the seed pipeline; after it finishes, the `references` column shape is `string[]` and a `references_v2_migrated` flag column is set on `knowledge_node`. Re-running the migration is a no-op when the flag is set. (Alternative: a parallel `knowledge_node_citation` join table -- see Open Question 3.)

## Behavior

### Citation lifecycle

Citations live in `study.citation`. They are created by the build pipeline (when authoring a syllabus YAML or migrating existing node references) and rarely user-edited. The set of citations is mostly stable; new ones land when new authored content references new sources.

The build script computes a content hash per citation `(reference_id, locator_kind, locator_data, framing, note)` and upserts on the hash so re-runs are idempotent.

### Credential DAG semantics

`getCertsCoveredBy(credentialId)` returns the credential plus all its required prerequisites, recursively. Used wherever the existing `certsCoveredBy(cert)` constant helper is called today; the new function reads from `credential_prereq` instead of the constant table.

A credential's `regulatory_basis` is one or more citations to the CFR sections that define it. Authoring example for the Private Pilot Certificate:

```yaml
slug: private
kind: pilot_cert
title: "Private Pilot Certificate"
category: airplane
class: null
regulatory_basis:
  - reference: 14cfr61
    locator:
      kind: cfr_section
      title: 14
      part: 61
      section: "103"
    framing: regulatory
    note: "Eligibility requirements for a private pilot certificate."
prereqs:
  - { slug: student, kind: required }
syllabi:
  - { slug: ppl-acs-2024-09, primacy: primary }
```

The seed pipeline reads each `course/credentials/<slug>.yaml`, upserts a `credential` row, upserts the cited citations, walks the prereqs (validating no cycles via topological sort), and upserts `credential_prereq` and `credential_syllabus` rows.

### Syllabus YAML authoring

Recommended layout (Open Question 2): one directory per syllabus under `course/syllabi/<slug>/` with a top-level `manifest.yaml` and one YAML file per Area under `areas/`:

```text
course/syllabi/ppl-acs-2024-09/
  manifest.yaml                    # syllabus metadata, credential link
  areas/
    I-preflight-preparation.yaml   # Area I tree (tasks + elements)
    II-preflight-procedures.yaml
    III-airport-and-seaplane-base-operations.yaml
    IV-takeoffs-landings-and-go-arounds.yaml
    V-performance-maneuvers.yaml   # the pilot-transcribed area
    VI-ground-reference-maneuvers.yaml
    VII-navigation.yaml
    VIII-slow-flight-and-stalls.yaml
    IX-basic-instrument-maneuvers.yaml
    X-emergency-operations.yaml
    XI-postflight-procedures.yaml
```

`manifest.yaml`:

```yaml
slug: ppl-acs-2024-09
kind: acs
title: "Private Pilot -- Airplane Airman Certification Standards"
edition: "FAA-S-ACS-6B"     # update to current edition (Open Question 5)
edition_published_at: 2024-09-01
source_url: "https://www.faa.gov/training_testing/testing/acs"
status: active
credentials:
  - { slug: private, primacy: primary }
```

`areas/V-performance-maneuvers.yaml`:

```yaml
code: V
title: "Performance Maneuvers"
ordinal: 5
tasks:
  - code: A
    title: "Steep Turns"
    ordinal: 1
    elements:
      - code: K1
        triad: knowledge
        title: "Aerodynamics of steep turns"
        required_bloom: understand
        description: "Aerodynamics associated with steep turns, to include increased load factor, overbank tendency, and maintaining coordinated flight."
        citations:
          - reference: phak
            locator: { kind: chapter_section, chapter: 5 }
            framing: survey
          - reference: afh
            locator: { kind: chapter_section, chapter: 9 }
            framing: operational
        knowledge_nodes:
          - { slug: aero-four-forces, weight: 0.6 }
          - { slug: aero-load-factor, weight: 1.0 }
      - code: R1
        triad: risk_management
        title: "Failure to maintain coordinated flight"
        required_bloom: apply
        ...
      - code: S1
        triad: skill
        title: "Clear the area, select an altitude that allows the maneuver to be performed no lower than 1,500 feet AGL..."
        required_bloom: apply
        ...
```

Validation (build-time, fail loud):

| Rule                                                                                               | Severity |
| -------------------------------------------------------------------------------------------------- | -------- |
| `manifest.yaml` exists for every syllabus directory.                                               | error    |
| Every area file's `code` is unique within the syllabus.                                            | error    |
| Every task's `code` is unique within its area.                                                     | error    |
| Every element's `code` is unique within its task.                                                  | error    |
| Element-level rows declare `triad` for ACS / PTS syllabi.                                          | error    |
| Element rows are leaves (no children) and carry `required_bloom`.                                  | error    |
| `parent_id` consistency (DB CHECK; matches YAML hierarchy).                                        | error    |
| `knowledge_nodes[].slug` resolves to an existing `knowledge_node.id`.                              | error    |
| `citations[].reference` resolves to an existing `reference.document_slug`.                         | error    |
| Citation `locator` shape matches `locator.kind`.                                                   | error    |
| Tree depth never exceeds element / section level.                                                  | error    |
| No cycles (parent of X must not be a descendant of X).                                             | error    |
| Element triad is one of K, R, S, or null (per ADR 016 -- separate K1/R1/S1 leaves preferred).      | warning  |

Errors abort the seed; warnings print and continue.

### Relevance cache rebuild

`bun run db build:relevance` walks every `syllabus` row whose `status='active'`, every leaf `syllabus_node` under it, every `syllabus_node_link` for that leaf, and accumulates `(cert, bloom, priority)` triples into a derived map keyed by `knowledge_node_id`.

- `cert` = `credential.slug` for credentials whose primary syllabus is this syllabus, expanded via `getCertsCoveredBy()` so the cache for "private" includes "private", "instrument" inherits "private", etc.
- `bloom` = leaf's `required_bloom`.
- `priority` is derived from the leaf's `triad` and the credential's role: a `K` (knowledge) leaf at an examiner level promotes `critical`; an `S` (skill) leaf on a credential inherited transitively promotes `standard`; lower-bloom inherited leaves promote `stretch`. Exact rule lives in design.md.

The triples are deduplicated (highest bloom wins per `(node, cert)` pair) and written to `knowledge_node.relevance` as a JSONB array matching the existing shape:

```typescript
[{ cert: 'private', bloom: 'apply', priority: 'critical' }, ...]
```

Migration cutover:

1. Run the rebuild script with `--dry-run`. Compare the cache to the authored YAML `relevance` field per node.
2. Surface diffs (added / removed / promoted / demoted entries per node) in a manifest summary file.
3. User reviews the diff, decides whether the cache is correct, and signs off.
4. Run the rebuild without `--dry-run`. Cache is written.
5. Run the YAML cleanup script that strips `relevance:` from every `course/knowledge/<slug>/node.md` frontmatter.
6. From this point on, `relevance` is derived only. Authoring touches it via the syllabus, never the node.

Re-running the rebuild against unchanged syllabi is a no-op (the computed cache equals the existing cache row by row).

### Goal -> session-engine handoff

Existing `study_plan.cert_goals` array converts to `goal` + `goal_syllabus` rows by a one-shot migration:

For each user with an active `study_plan`:

1. Insert a `goal` row with `title='Active Plan Goal'`, `status='active'`, `is_primary=true`.
2. For each cert in `study_plan.cert_goals`, look up the credential (via `slug`), find its primary syllabus, and insert a `goal_syllabus(goal_id, syllabus_id, weight=1.0)` row.

After migration, `cert_goals` stays on `study_plan` as a derived view (Open Question 4): a generated column or BC-layer derivation that walks the user's primary goal's `goal_syllabus` rows and projects them back to the cert slugs the existing engine reads. The session engine continues reading `cert_goals` from `study_plan`. A follow-on WP cuts the engine over to read from `goal_syllabus` directly and removes the derivation.

### Lens framework (BC + types only)

`Lens` type signature:

```typescript
export type LensInput = {
	goal: Goal | null;          // null = anonymous browse
	filters?: {
		areaCodes?: string[];
		taskCodes?: string[];
		elementCodes?: string[];
		domains?: Domain[];
		bloomLevels?: BloomLevel[];
		credentials?: string[];     // credential slugs
	};
};

export type LensTreeNode = {
	id: string;                       // sln_... | node slug | aggregate id
	level: 'cert' | 'area' | 'task' | 'element' | 'domain' | 'phase' | 'handbook' | 'chapter' | 'section' | 'node';
	title: string;
	rollup: MasteryRollup;            // mastery + coverage at this node
	children?: LensTreeNode[];
	leaves?: LensLeaf[];              // when this is a leaf-bearing internal node
};

export type LensLeaf = {
	id: string;
	knowledgeNodeId: string;
	title: string;
	requiredBloom?: BloomLevel;
	triad?: ACSTriad;
	mastery: NodeMastery;             // dual-gate result for this user
};

export type LensResult = {
	tree: LensTreeNode;
	totalLeaves: number;
	coveredLeaves: number;
	masteredLeaves: number;
};

export type Lens = (db: Db, userId: string, input: LensInput) => Promise<LensResult>;
```

Two lenses ship in this WP:

- **ACS lens** (`acsLens`): tree shape Area -> Task -> Element. Source: a credential's primary syllabus. Input: a goal (resolves to one or more credentials, each contributing an ACS subtree). Used by the cert dashboard follow-on for the Area / Task / Element rollup.
- **Domain lens** (`domainLens`): tree shape Domain -> nodes. Source: graph metadata (`knowledge_node.domain` + `cross_domains`). Filters by goal's union of nodes + ad-hoc nodes. Used by the existing `/knowledge` browse surface.

`LENS_KINDS` constant enumerates `acs`, `pts`, `endorsement`, `domain`, `phase`, `handbook`, `weakness`, `bloom`, `custom`. Only `acs` and `domain` have implementations in this WP; the rest are typed-but-not-implemented entries that follow-on WPs replace.

### Mastery rollup at credential level

`getCredentialMastery(db, userId, credentialSlug) -> CredentialMasteryRollup`:

```typescript
export type CredentialMasteryRollup = {
	credentialId: string;
	credentialSlug: string;
	primarySyllabusId: string | null;
	totalLeaves: number;
	coveredLeaves: number;       // leaves with at least one knowledge_node link AND that node has any evidence
	masteredLeaves: number;      // leaves whose linked node's mastery dual-gate passes (per ADR 011)
	areas: Array<{
		areaCode: string;
		areaTitle: string;
		totalLeaves: number;
		masteredLeaves: number;
	}>;
};
```

Used by `/credentials/[slug]` and the future cert-dashboard surface. Computed via a single aggregate query joining `syllabus_node`, `syllabus_node_link`, `knowledge_node`, and the existing per-user mastery aggregates from `libs/bc/study/src/knowledge.ts`.

## BC Surface

All exports from `libs/bc/study/src/index.ts`. New files:

- `citations.ts` -- citation CRUD + URL resolver extension.
- `credentials.ts` -- credential DAG walks, mastery rollup, list helpers.
- `syllabi.ts` -- syllabus tree walks, leaf links, citation lookup.
- `goals.ts` -- goal CRUD, active-goal resolution, weighted union.
- `lenses.ts` -- Lens type + ACS lens + Domain lens.
- `citations.test.ts`, `credentials.test.ts`, `syllabi.test.ts`, `goals.test.ts`, `lenses.test.ts` -- unit coverage.

Extensions:

- `handbooks.ts` -- `resolveCitationUrl` extended for non-handbook kinds.

### Functions

| File             | Function                                  | Signature                                                                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `citations.ts`   | `listCitations`                           | `(db, opts?: { referenceId?: string; locatorKind?: CitationLocatorKind }) -> CitationRow[]`                        |
| `citations.ts`   | `getCitation`                             | `(db, id: string) -> CitationRow \| null`                                                                          |
| `citations.ts`   | `getCitationsForKnowledgeNode`            | `(db, knowledgeNodeId: string) -> CitationRow[]`                                                                   |
| `citations.ts`   | `getCitationsForSyllabusNode`             | `(db, syllabusNodeId: string) -> CitationRow[]`                                                                    |
| `citations.ts`   | `resolveCitationUrl` (extended)           | `(citation: CitationRow, references: ReferenceRow[], handbookSections?: HandbookSectionRow[]) -> string \| null`   |
| `credentials.ts` | `listCredentials`                         | `(db, opts?: { kind?: CredentialKind; status?: CredentialStatus }) -> CredentialRow[]`                             |
| `credentials.ts` | `getCredentialBySlug`                     | `(db, slug: string) -> CredentialRow \| null`                                                                      |
| `credentials.ts` | `getCertsCoveredBy`                       | `(db, credentialId: string) -> string[]` (credential slugs, includes self, recursive over `credential_prereq`)     |
| `credentials.ts` | `getCredentialPrereqDag`                  | `(db) -> { nodes: CredentialRow[]; edges: CredentialPrereqRow[] }` (for visualisation / future graph surfaces)      |
| `credentials.ts` | `getCredentialPrimarySyllabus`            | `(db, credentialId: string) -> SyllabusRow \| null`                                                                |
| `credentials.ts` | `getCredentialMastery`                    | `(db, userId: string, credentialSlug: string) -> CredentialMasteryRollup`                                          |
| `syllabi.ts`     | `listSyllabi`                             | `(db, opts?: { kind?: SyllabusKind; status?: SyllabusStatus }) -> SyllabusRow[]`                                   |
| `syllabi.ts`     | `getSyllabusBySlug`                       | `(db, slug: string) -> SyllabusRow \| null`                                                                        |
| `syllabi.ts`     | `getSyllabusTree`                         | `(db, syllabusId: string) -> SyllabusNodeRow[]` (in-order, full tree for the syllabus)                             |
| `syllabi.ts`     | `getSyllabusArea`                         | `(db, syllabusId: string, areaCode: string) -> { area: SyllabusNodeRow; tasks: SyllabusNodeRow[]; elements: SyllabusNodeRow[] }` |
| `syllabi.ts`     | `getSyllabusLeavesForNode`                | `(db, knowledgeNodeId: string) -> SyllabusNodeWithSyllabusRow[]` (every leaf that links to this node)              |
| `syllabi.ts`     | `getNodesForSyllabusLeaf`                 | `(db, syllabusNodeId: string) -> KnowledgeNodeRow[]` (every node a leaf links to)                                  |
| `goals.ts`       | `listGoals`                               | `(db, userId: string, opts?: { status?: GoalStatus }) -> GoalRow[]`                                                |
| `goals.ts`       | `getActiveGoals`                          | `(db, userId: string) -> GoalRow[]` (all `status='active'`; multiple allowed per Open Question 1)                  |
| `goals.ts`       | `getPrimaryGoal`                          | `(db, userId: string) -> GoalRow \| null`                                                                          |
| `goals.ts`       | `createGoal`                              | `(db, data: CreateGoalInput) -> GoalRow`                                                                           |
| `goals.ts`       | `updateGoal`                              | `(db, goalId, userId, data: UpdateGoalInput) -> GoalRow`                                                           |
| `goals.ts`       | `setPrimaryGoal`                          | `(db, goalId, userId) -> GoalRow` (transactional: clears `is_primary` on others; sets on this one)                 |
| `goals.ts`       | `archiveGoal`                             | `(db, goalId, userId) -> void`                                                                                     |
| `goals.ts`       | `addGoalSyllabus`                         | `(db, goalId, userId, data: AddGoalSyllabusInput) -> GoalSyllabusRow`                                              |
| `goals.ts`       | `removeGoalSyllabus`                      | `(db, goalId, userId, syllabusId) -> void`                                                                         |
| `goals.ts`       | `addGoalNode`                             | `(db, goalId, userId, knowledgeNodeId, reason?) -> GoalNodeRow`                                                    |
| `goals.ts`       | `removeGoalNode`                          | `(db, goalId, userId, knowledgeNodeId) -> void`                                                                    |
| `goals.ts`       | `getGoalNodeUnion`                        | `(db, goalId) -> { knowledgeNodeIds: string[]; weights: Record<string, number> }` (every node reachable through the goal's syllabi + ad-hoc nodes, with weights aggregated) |
| `goals.ts`       | `getDerivedCertGoals`                     | `(db, userId: string) -> string[]` (cert slugs derived from primary goal's syllabi -- backwards-compat for engine) |
| `lenses.ts`      | `acsLens`                                 | `Lens` (Area -> Task -> Element tree)                                                                              |
| `lenses.ts`      | `domainLens`                              | `Lens` (Domain -> nodes tree)                                                                                      |
| `handbooks.ts`   | `resolveCitationUrl` (extended)           | extends WP #1 to handle every `CitationLocatorKind`.                                                               |

### Build-script-only helpers (not exported from BC barrel)

| File             | Function                                  | Signature                                                                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `citations.ts`   | `upsertCitation`                          | `(db, data: NewCitationRow) -> string`                                                                             |
| `credentials.ts` | `upsertCredential`                        | `(db, data: NewCredentialRow) -> string`                                                                           |
| `credentials.ts` | `upsertCredentialPrereq`                  | `(db, data: NewCredentialPrereqRow) -> void`                                                                       |
| `credentials.ts` | `upsertCredentialSyllabus`                | `(db, data: NewCredentialSyllabusRow) -> void`                                                                     |
| `syllabi.ts`     | `upsertSyllabus`                          | `(db, data: NewSyllabusRow) -> string`                                                                             |
| `syllabi.ts`     | `upsertSyllabusNode`                      | `(db, data: NewSyllabusNodeRow) -> string`                                                                         |
| `syllabi.ts`     | `replaceSyllabusNodeLinks`                | `(db, syllabusNodeId: string, links: NewSyllabusNodeLinkRow[]) -> void`                                            |
| `syllabi.ts`     | `rebuildKnowledgeNodeRelevanceCache`      | `(db, opts?: { dryRun?: boolean }) -> RelevanceCacheReport`                                                        |

### Errors

`CitationNotFoundError`, `CredentialNotFoundError`, `CredentialPrereqCycleError`, `SyllabusNotFoundError`, `SyllabusValidationError`, `GoalNotFoundError`, `GoalNotPrimaryError`. Match existing BC error-class style.

## Routes

`libs/constants/src/routes.ts` additions:

```typescript
// Cert dashboard (pages in follow-on WP)
CREDENTIALS: '/credentials',
CREDENTIAL: (slug: string) => `/credentials/${encodeURIComponent(slug)}` as const,
CREDENTIAL_AREA: (slug: string, areaCode: string) =>
	`/credentials/${encodeURIComponent(slug)}/areas/${encodeURIComponent(areaCode)}` as const,
CREDENTIAL_TASK: (slug: string, areaCode: string, taskCode: string) =>
	`/credentials/${encodeURIComponent(slug)}/areas/${encodeURIComponent(areaCode)}/tasks/${encodeURIComponent(taskCode)}` as const,
CREDENTIAL_AT_EDITION: (slug: string, edition: string) =>
	`/credentials/${encodeURIComponent(slug)}?${QUERY_PARAMS.EDITION}=${encodeURIComponent(edition)}` as const,

// Personal goals (pages in follow-on WP)
GOALS: '/goals',
GOALS_NEW: '/goals/new',
GOAL: (id: string) => `/goals/${encodeURIComponent(id)}` as const,
GOAL_EDIT: (id: string) => `/goals/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,
```

`NAV_LABELS.CREDENTIALS = 'Credentials'`, `NAV_LABELS.GOALS = 'Goals'`.

## Constants

`libs/constants/src/study.ts` additions (or split into `libs/constants/src/credentials.ts` + `libs/constants/src/syllabi.ts` if `study.ts` is feeling heavy and re-exported from `index.ts`):

```typescript
export const CITATION_LOCATOR_KINDS = {
	CHAPTER_SECTION: 'chapter_section',
	CFR_SECTION: 'cfr_section',
	ACS_TASK: 'acs_task',
	AC_PARAGRAPH: 'ac_paragraph',
	AIM_PARAGRAPH: 'aim_paragraph',
	PCG_TERM: 'pcg_term',
	PAGE: 'page',
	OTHER: 'other',
} as const;
export type CitationLocatorKind = (typeof CITATION_LOCATOR_KINDS)[keyof typeof CITATION_LOCATOR_KINDS];
export const CITATION_LOCATOR_KIND_VALUES = Object.values(CITATION_LOCATOR_KINDS);

export const CITATION_FRAMINGS = {
	SURVEY: 'survey',
	OPERATIONAL: 'operational',
	PROCEDURAL: 'procedural',
	REGULATORY: 'regulatory',
	EXAMINER: 'examiner',
} as const;
export type CitationFraming = (typeof CITATION_FRAMINGS)[keyof typeof CITATION_FRAMINGS];
export const CITATION_FRAMING_VALUES = Object.values(CITATION_FRAMINGS);

export const CREDENTIAL_KINDS = {
	PILOT_CERT: 'pilot_cert',
	INSTRUCTOR_CERT: 'instructor_cert',
	RATING: 'rating',
	ENDORSEMENT: 'endorsement',
} as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[keyof typeof CREDENTIAL_KINDS];
export const CREDENTIAL_KIND_VALUES = Object.values(CREDENTIAL_KINDS);

export const CREDENTIAL_PREREQ_KINDS = {
	REQUIRED: 'required',
	RECOMMENDED: 'recommended',
} as const;
export type CredentialPrereqKind = (typeof CREDENTIAL_PREREQ_KINDS)[keyof typeof CREDENTIAL_PREREQ_KINDS];
export const CREDENTIAL_PREREQ_KIND_VALUES = Object.values(CREDENTIAL_PREREQ_KINDS);

export const CREDENTIAL_CATEGORIES = {
	AIRPLANE: 'airplane',
	ROTORCRAFT: 'rotorcraft',
	GLIDER: 'glider',
	BALLOON: 'balloon',
	POWERED_LIFT: 'powered-lift',
	NONE: 'none',
} as const;
export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[keyof typeof CREDENTIAL_CATEGORIES];
export const CREDENTIAL_CATEGORY_VALUES = Object.values(CREDENTIAL_CATEGORIES);

export const CREDENTIAL_CLASSES = {
	SINGLE_ENGINE_LAND: 'single-engine-land',
	MULTI_ENGINE_LAND: 'multi-engine-land',
	SINGLE_ENGINE_SEA: 'single-engine-sea',
	MULTI_ENGINE_SEA: 'multi-engine-sea',
} as const;
export type CredentialClass = (typeof CREDENTIAL_CLASSES)[keyof typeof CREDENTIAL_CLASSES];
export const CREDENTIAL_CLASS_VALUES = Object.values(CREDENTIAL_CLASSES);

export const CREDENTIAL_STATUSES = {
	ACTIVE: 'active',
	ARCHIVED: 'archived',
} as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[keyof typeof CREDENTIAL_STATUSES];
export const CREDENTIAL_STATUS_VALUES = Object.values(CREDENTIAL_STATUSES);

export const SYLLABUS_KINDS = {
	ACS: 'acs',
	PTS: 'pts',
	ENDORSEMENT: 'endorsement',
	SCHOOL: 'school',
	PERSONAL: 'personal',
} as const;
export type SyllabusKind = (typeof SYLLABUS_KINDS)[keyof typeof SYLLABUS_KINDS];
export const SYLLABUS_KIND_VALUES = Object.values(SYLLABUS_KINDS);

export const SYLLABUS_STATUSES = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	ARCHIVED: 'archived',
} as const;
export type SyllabusStatus = (typeof SYLLABUS_STATUSES)[keyof typeof SYLLABUS_STATUSES];
export const SYLLABUS_STATUS_VALUES = Object.values(SYLLABUS_STATUSES);

export const SYLLABUS_NODE_LEVELS = {
	AREA: 'area',
	TASK: 'task',
	ELEMENT: 'element',
	SECTION: 'section',
} as const;
export type SyllabusNodeLevel = (typeof SYLLABUS_NODE_LEVELS)[keyof typeof SYLLABUS_NODE_LEVELS];
export const SYLLABUS_NODE_LEVEL_VALUES = Object.values(SYLLABUS_NODE_LEVELS);

export const SYLLABUS_PRIMACY = {
	PRIMARY: 'primary',
	ALTERNATE: 'alternate',
} as const;
export type SyllabusPrimacy = (typeof SYLLABUS_PRIMACY)[keyof typeof SYLLABUS_PRIMACY];
export const SYLLABUS_PRIMACY_VALUES = Object.values(SYLLABUS_PRIMACY);

export const ACS_TRIAD = {
	KNOWLEDGE: 'knowledge',
	RISK_MANAGEMENT: 'risk_management',
	SKILL: 'skill',
} as const;
export type ACSTriad = (typeof ACS_TRIAD)[keyof typeof ACS_TRIAD];
export const ACS_TRIAD_VALUES = Object.values(ACS_TRIAD);

export const LENS_KINDS = {
	ACS: 'acs',
	PTS: 'pts',
	ENDORSEMENT: 'endorsement',
	DOMAIN: 'domain',
	PHASE: 'phase',
	HANDBOOK: 'handbook',
	WEAKNESS: 'weakness',
	BLOOM: 'bloom',
	CUSTOM: 'custom',
} as const;
export type LensKind = (typeof LENS_KINDS)[keyof typeof LENS_KINDS];
export const LENS_KIND_VALUES = Object.values(LENS_KINDS);

export const GOAL_STATUSES = {
	ACTIVE: 'active',
	PAUSED: 'paused',
	ARCHIVED: 'archived',
} as const;
export type GoalStatus = (typeof GOAL_STATUSES)[keyof typeof GOAL_STATUSES];
export const GOAL_STATUS_VALUES = Object.values(GOAL_STATUSES);

export const CITATION_ID_PREFIX = 'cit';
export const CREDENTIAL_ID_PREFIX = 'cred';
export const SYLLABUS_ID_PREFIX = 'syl';
export const SYLLABUS_NODE_ID_PREFIX = 'sln';
export const SYLLABUS_NODE_LINK_ID_PREFIX = 'snl';
export const GOAL_ID_PREFIX = 'goal';
```

`CERTS` / `CERT_VALUES` / `CERT_LABELS` / `CERT_PREREQUISITES` retire as authoritative (deprecation comment); become a derived view of the credential DAG. Concretely:

- `CERTS` stays as the authoring shortcut (PPL/IR/CPL/CFI -- the four-cert dashboard subset) because the existing study-plan dashboard column headers + study-plan wizard need a stable closed enum.
- `CERT_PREREQUISITES` constant gets a deprecation comment with `// @deprecated -- use getCertsCoveredBy(db, credentialId) from @ab/bc-study; retained as a fast-path for the four-cert dashboard subset` and is no longer read by any new code path. The session engine cuts over to `getCertsCoveredBy()` in the follow-on engine WP.

`CERT_APPLICABILITIES` (in `reference-tags.ts`) stays as the authoring shortcut for the 5-axis reference taxonomy. The credential DAG and the cert-applicability tag overlap; collapsing them is a follow-on cleanup once both are stable.

## Validation

| Field / surface                                          | Rule                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `citation.locator_kind`                                  | In `CITATION_LOCATOR_KIND_VALUES`. CHECK.                                                                  |
| `citation.framing`                                       | In `CITATION_FRAMING_VALUES`. CHECK.                                                                       |
| `citation.locator_data`                                  | JSONB shape matches `locator_kind` (validated at the BC layer; DB CHECK can't express discriminated-union shape over JSONB). |
| `credential.kind`                                        | In `CREDENTIAL_KIND_VALUES`. CHECK.                                                                        |
| `credential.category`                                    | In `CREDENTIAL_CATEGORY_VALUES`. CHECK.                                                                    |
| `credential.class`                                       | NULL or in `CREDENTIAL_CLASS_VALUES`. CHECK.                                                               |
| `credential.slug`                                        | UNIQUE, kebab-case, 2-64 chars.                                                                            |
| `credential_prereq` cycle                                | Build script aborts if a cycle is detected (topological sort).                                             |
| `credential_syllabus` primary uniqueness                 | Partial UNIQUE on `(credential_id) WHERE primacy='primary'`.                                               |
| `syllabus.kind`                                          | In `SYLLABUS_KIND_VALUES`. CHECK.                                                                          |
| `syllabus.status`                                        | In `SYLLABUS_STATUS_VALUES`. CHECK.                                                                        |
| `syllabus (slug)`                                        | UNIQUE.                                                                                                    |
| `syllabus (kind, edition)`                               | UNIQUE for `kind IN ('acs','pts')`. Partial unique index.                                                  |
| `syllabus_node.level`                                    | In `SYLLABUS_NODE_LEVEL_VALUES`. CHECK.                                                                    |
| `syllabus_node.parent_id` / `level` consistency          | DB CHECK (see Data Model).                                                                                 |
| `syllabus_node.triad`                                    | NULL or in `ACS_TRIAD_VALUES`; non-NULL only when `level='element'`. CHECK.                                |
| `syllabus_node.required_bloom`                           | NULL or in `BLOOM_LEVEL_VALUES`; non-NULL only when `is_leaf=true`. CHECK.                                 |
| `syllabus_node (syllabus_id, code)`                      | UNIQUE.                                                                                                    |
| `syllabus_node_link.syllabus_node_id`                    | Must point at a leaf row. Enforced by BC + seed.                                                           |
| `syllabus_node_link (syllabus_node_id, knowledge_node_id)` | UNIQUE.                                                                                                  |
| `goal.status`                                            | In `GOAL_STATUS_VALUES`. CHECK.                                                                            |
| `goal.is_primary` per user                               | Partial UNIQUE on `(user_id) WHERE is_primary=true`.                                                       |
| `goal_syllabus.weight`                                   | `> 0 AND <= 10.0`. CHECK.                                                                                  |
| `goal_syllabus (goal_id, syllabus_id)`                   | Composite PK.                                                                                              |
| `goal_node (goal_id, knowledge_node_id)`                 | Composite PK.                                                                                              |
| `knowledge_node.references` post-migration               | Every entry must be a string matching `^cit_[A-Z0-9]+$` and resolve to an existing `citation.id`. Build script enforces. |

## Edge cases

- **Circular credential prereq.** Build script detects via topological sort, aborts with the cycle path. Pre-existing data with cycles (none expected) gets the same treatment.
- **Syllabus leaf links to a knowledge node that gets deleted.** FK ON DELETE CASCADE removes the `syllabus_node_link`. The leaf survives (still has its description and citations); the linked-nodes column at that leaf goes from non-empty to empty. Coverage rollup updates. The build warns about leaves with zero links (a leaf that points at no nodes still counts as a leaf for the syllabus tree but is implicitly "uncovered").
- **A leaf points at a node that has zero evidence** (no cards, no reps, no node_start records). Mastery rollup treats it as `INSUFFICIENT_DATA`; coverage rollup counts the leaf as covered (link exists) but not mastered.
- **Two syllabi link the same node at different blooms.** The relevance cache records the highest required bloom per `(node, cert)` pair. Both leaves remain queryable through `getSyllabusLeavesForNode`.
- **A goal references a syllabus that gets archived.** The `goal_syllabus` row stays (FK ON DELETE RESTRICT prevents silent removal). The lens that walks the goal sees the syllabus row, notes its archived status, and surfaces a "this syllabus is archived; update your goal" affordance in the UI follow-on.
- **A goal's primary flag is flipped while another goal's flag is also true.** Partial UNIQUE prevents this at the DB level. The BC `setPrimaryGoal` is transactional: clears every other goal's `is_primary=true` for the user, then sets the target. Race conditions return a constraint-violation error which the BC translates to `GoalAlreadyPrimaryError`.
- **The migration of `knowledge_node.references` runs twice.** Idempotent: it only mutates rows where `references_v2_migrated=false`. Running on already-migrated rows is a no-op.
- **A YAML syllabus file references a citation kind not yet supported by `resolveCitationUrl`.** Validation passes (citation kind is closed-enum); the resolver returns `null` for that kind in v1. UI fallback renders the citation note as freeform text. Same pattern WP #1 used for non-handbook kinds.
- **Multiple active goals exist; engine asks for primary.** `getPrimaryGoal()` returns the row marked `is_primary=true`. If somehow no goal carries the flag (a state the partial UNIQUE prevents on insert but a pre-migration row could lack), the BC marks the most recently updated `active` goal as primary lazily on first read. Surfaced as a one-time backfill log line.
- **A credential has zero syllabi.** Permitted -- some endorsements (e.g., spin training) don't have a published syllabus. The cert dashboard surface displays a placeholder ("no syllabus yet -- add one in /goals" or similar; full UX in follow-on).
- **Pilot transcription Area V uses a knowledge node that gets renamed in `course/knowledge/` after the syllabus YAML is authored.** The seed errors with `knowledge_node 'aero-load-factor-old' referenced by syllabus_node sln_... does not exist; rename or remove`. Fix by either renaming the syllabus YAML to match or migrating the knowledge node back. Hard-fail on dangling references is the right shape.
- **Existing `study_plan.cert_goals` array contains a cert slug not in the credential table** (legacy/garbage data). Migration script logs a warning per orphaned cert and skips that entry. The user keeps their goal but with one fewer syllabus; surface in the follow-on UI as "we found unmappable certs in your old plan."

## Open Questions

The user resolves each before tasks/test-plan finalize. Each carries a recommendation and rationale.

### 1. One active goal per user, or multiple?

**Recommended: multiple active, exactly one `is_primary` per user.**

The `is_primary` goal drives the session engine's targeting (the cert/syllabus filter the engine reads). Other active goals exist for parallel tracks (e.g., "PPL refresher" primary + "BFR currency" parallel) and are visible in the goal list, but they don't compete for engine time without an explicit primary swap.

| Option                                            | For                                                                                                              | Against                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple active, one primary (recommended)        | Mirrors how user zero actually thinks ("I'm working on PPL refresh + add IR + stay BFR-current"). Primary is unambiguous for the engine. | Two affordances (active + primary) require a clear UI to avoid confusion. Mitigated by surfacing primary on every relevant page.      |
| Strictly one active per user                      | Simpler model. Engine never has to disambiguate.                                                                 | Forces user zero to archive a goal whenever he wants to push a parallel track, even though both are "things I am working on."         |
| Unlimited active treated equally                  | No primary concept. Engine takes a weighted union across all actives.                                            | Engine has no clean handle for "which goal am I in right now?" Surfacing the right one on the dashboard becomes a heuristic.          |

### 2. Syllabus YAML authoring shape -- one big file per syllabus, or directory tree?

**Recommended: directory tree mirroring the FAA hierarchy. One file per Area under `course/syllabi/<slug>/areas/<area-code>-<slug>.yaml`, with a top-level `manifest.yaml` for syllabus metadata.**

| Option                              | For                                                                                                              | Against                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| One file per Area (recommended)     | Matches the FAA's organization. Each file is reviewable independently. Diffs in PRs stay local to one area. Authoring concurrency: one author can transcribe Area V while another transcribes Area VIII. | More files. Adds a layer of indirection (the manifest aggregates).                                                                    |
| One big file per syllabus           | One file. Simple to author for tiny syllabi (endorsements with 5-10 leaves).                                     | PPL ACS has ~600 element leaves. One YAML file would be unreadable, slow to render in IDEs, awful to diff.                            |
| One file per Task (deeper tree)     | Even tighter scoping per file.                                                                                   | More boilerplate per file. The Area boundary is the natural unit of FAA authorship and grading; below that is over-decomposition.    |

For very small syllabi (endorsements), the manifest can carry the full tree inline; the `areas/` directory becomes optional. Validator handles both shapes.

### 3. Citations on `syllabus_node` -- separate join table or JSONB array of citation_ids?

**Recommended: JSONB array of citation_ids on the `syllabus_node` row. Matches how `knowledge_node.references` is being reshaped, which keeps the two consumers consistent.**

| Option                                            | For                                                                                                              | Against                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| JSONB array of citation_ids (recommended)         | Matches `knowledge_node` post-migration. One read pattern. Cheap to serialize. GIN index handles reverse queries ("which leaves cite this citation"). | Citation order is stored implicitly by array order; reordering requires an array rewrite (acceptable for this use case).             |
| Dedicated `syllabus_node_citation` join table     | Foreign-key integrity at the row level. Easier ad-hoc queries on the join (`SELECT ... FROM syllabus_node_citation WHERE citation_id = ?`). | Two patterns for the same conceptual relationship in the same DB. Inconsistency between `knowledge_node` and `syllabus_node`.        |

A separate join table can be added later additively if reverse-query performance ever needs it. The JSONB-with-GIN pattern is good enough for the scale we expect.

### 4. What happens to `study_plan.cert_goals` after Goal is introduced?

**Recommended: keep `cert_goals` as a derived view (computed via `getDerivedCertGoals(userId)` in the BC, surfaced on `study_plan` reads as a virtual column) for backwards compatibility with the existing session engine. Drop the column entirely in a follow-on WP that cuts the engine over to read goal-derived filters directly.**

| Option                                                       | For                                                                                                              | Against                                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Derived view, deprecated, removed in follow-on (recommended) | Zero-risk migration -- the engine keeps reading `cert_goals` and gets the same data. Removal is a clean follow-on. | Two paths to "what is this user studying for" until the follow-on lands. Mitigated by clear deprecation comment.                      |
| Hard cutover -- engine reads goal directly from day one      | Single source of truth from the start.                                                                           | Couples this WP to a session-engine refactor. Engine tests + plan-edit flows + skip-domain mutations all need touching. Wider blast radius. |
| Drop `cert_goals` immediately, leave engine reading nothing  | (No, this is broken; listed for completeness.)                                                                   | Engine breaks.                                                                                                                         |

### 5. PPL ACS edition

**Recommended: lock seed data to the currently-published PPL ACS at the moment this WP merges. The user should verify the current edition before the seed lands; spec records `FAA-S-ACS-6B` as a placeholder pending verification.**

ACS editions have evolved; the user must confirm at WP author time which edition is current. The seed data becomes correct at that moment; subsequent FAA publication of a new edition produces a new syllabus row (per ADR 016's resolved decision -- a new edition is a new row, not an edit). Goals can opt to migrate.

If the FAA has published `FAA-S-ACS-15` (a hypothetical successor), spec stays generic ("the current PPL ACS edition at the time the user signs off this WP"); seed data uses whatever the user verifies.

### 6. Pilot transcription subset -- which Area to transcribe first?

**Recommended: PPL ACS Area V "Performance Maneuvers" -- 3 tasks (Steep Turns; Steep Spirals; Chandelles or whatever Area V's third task is in the current edition), expanding to ~24 K/R/S element leaves.**

Why this Area:

- Small enough to be a day's authoring work. Big enough to exercise the K/R/S triad split across all three tasks.
- Connects cleanly to existing knowledge nodes (angle-of-attack-and-stall, four-forces, load-factor) so the linking phase is non-trivial.
- The S elements are demonstrably skill-only -- you cannot card your way to "demonstrate steep turns" -- which exercises the lens-evidence-gating data shape.

Alternates considered:

| Alternate                                | For                                                            | Against                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Area I "Preflight Preparation"           | First in the ACS; large variety of K elements.                 | Mostly K elements, weak on R / S. Doesn't exercise the full triad split.                                                 |
| Area IX "Emergency Operations"           | High-stakes; exercises judgment + skill leaves richly.         | Cross-references many knowledge nodes that aren't authored yet. Linking phase blocks on graph content, not the WP shape. |

## Migration considerations

- **`knowledge_node.references` migration is one-shot.** Runs once via `bun run db migrate:references-to-citations`. After migration, the column shape is a `string[]` of citation_ids. A `references_v2_migrated` boolean flag gates the script. The flag is dropped in a follow-on cleanup once every environment has migrated.
- **Knowledge-node YAML `relevance` field is dropped.** After the relevance cache rebuild succeeds, a one-shot script (`bun run db migrate:drop-authored-relevance`) removes `relevance:` from every `course/knowledge/<slug>/node.md` frontmatter. The git diff is reviewable; user signs off before the script runs.
- **Existing `study_plan.cert_goals` migrates to `goal` + `goal_syllabus` rows.** One-shot script. Idempotent via a `study_plan.goal_migrated_at` timestamp column added by this WP and removed in the follow-on cleanup.
- **`CERT_PREREQUISITES` constant gets a deprecation comment.** No behavior change in this WP; readers continue to use the constant where they do today. The session engine WP follow-on cuts over to `getCertsCoveredBy()`.
- **Drizzle migration.** Schema additions ship as a single drizzle migration (next sequence number after WP #1's `0010_handbook_ingestion.sql`). One file: `0011_cert_syllabus_goal.sql`. Includes the citation table, credential tables, syllabus tables, goal tables, the `references_v2_migrated` and `goal_migrated_at` flag columns, and the partial UNIQUE indexes.
- **Seed sequencing.** New `bun run db seed` phases land in this order: `references` (WP #1 seeds reference + handbook_section), `citations` (this WP), `credentials` (this WP), `syllabi` (this WP), `goals` (this WP -- empty; user creates goals in-app). The relevance cache rebuild runs as the last phase before the YAML cleanup script.

## Risks

| Risk                                                                                            | Mitigation                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ACS transcription is slower than estimated and Area V doesn't ship in this WP.                  | Transcription is bounded human work, not blocking on WP merge; the schema, validator, and seed pipeline ship regardless. |
| Knowledge node slugs change after a syllabus links to them, breaking links.                     | Build validator hard-fails on dangling links. CI rejects PRs that break the link contract; user sees the error before merge. |
| Credential DAG seed data has a cycle the topological sort misses.                               | Unit test that runs the topological sort against the seed YAML fixtures; coverage of every kind of cred. Test fails before merge. |
| Existing per-node authored `relevance` array disagrees with the rebuilt cache.                  | Rebuild script with `--dry-run` produces a diff manifest. User reviews and signs off before the cache writes. |
| Two follow-on WPs (cert dashboard pages, goal composer pages) get blocked on this WP's BC shape. | This WP's BC functions ship complete with unit tests; the follow-ons consume the BC, not the schema, so internal schema changes don't leak. |
| `study_plan.cert_goals` derived view drifts from goal data because the engine writes both.      | One-way derivation: goal is source, `cert_goals` is computed on read. Engine never writes `cert_goals` after migration; engine writes go to goal_syllabus. |
| Multi-engine-instrument-instructor (`meii`) is not a clean atomic credential in real FAA practice. | Document the modeling decision in design.md (`meii = mei + ii_addon` or `meii = cfii + multi-engine class rating`); pick one based on how 14 CFR 61.183 actually decomposes. |
| Schema migration `0011` lands while existing PRs touch `knowledge_node.references`.             | Coordinate merge order. Open PRs that touch `references` rebase before this WP's migration; this WP's migration handles both legacy and structured shapes.  |
| Lens framework type signature is too narrow and follow-on lenses can't fit.                     | Ship two lenses in this WP (ACS, Domain) -- two different shapes -- so the type proves it generalizes before more land. |

## References

- [Design](./design.md) -- rationale, alternatives considered, key decisions
- [Tasks](./tasks.md) -- phased implementation plan
- [Test plan](./test-plan.md) -- manual acceptance scenarios
- [User stories](./user-stories.md) -- learner-perspective narratives
- [ADR 016 decision](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [ADR 016 context](../../decisions/016-cert-syllabus-goal-model/context.md)
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md)
- [ADR 011 decision](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [Handbook Ingestion and Reader spec](../handbook-ingestion-and-reader/spec.md) -- the WP this composes on top of
- [Handbook Ingestion and Reader design](../handbook-ingestion-and-reader/design.md)
- [Knowledge Graph spec](../knowledge-graph/spec.md) -- the underlying graph this projects onto
- [Study Plan + Session Engine spec](../study-plan-and-session-engine/spec.md) -- the engine that consumes goals
