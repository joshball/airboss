---
title: 'Spec: Knowledge Graph'
product: study
feature: knowledge-graph
type: spec
status: unread
review_status: pending
---

# Spec: Knowledge Graph

A directed graph of aviation knowledge units with rich metadata, typed edges, and a seven-phase content model. Authored as markdown + YAML in `course/knowledge/`, built into Postgres via a build script, queried by the study BC. v1 ships the **30-node skeleton** from [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md): all 30 node directories created with full metadata + typed edges, 3-5 nodes deeply filled across all seven phases, one node wired to an interactive activity, a node detail page that renders mastery state, and backward-compatible `node_id` links on `study.card` and `study.scenario`.

Depends on: Spaced Memory Items (schema, BC structure, domain constants), Decision Reps (scenario schema -- ships before this feature per ADR 011 build order).

## v1 scope reconciliation (2026-04-20)

The **shipped schema** on main (PR #6) is a deliberate simplification of the full spec below. The two agree on the data model; the spec's extra tables and columns are deferred to v2 without loss of functionality for the canary and session-engine use cases.

| Spec item                                                          | v1 on main                                                                 | v2 deferred reason                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `knowledge_node.id` + `slug`                                       | Single `id` column doubles as slug (kebab-case)                            | Split to ULID `id` + `slug` once a non-slug rename use case appears. Slug renames are rare at 30 nodes.          |
| `content_path`                                                     | Not stored; derived from domain + id at read time                          | Add once multi-author workflows need a canonical authoring-file pointer back from DB rows.                       |
| `lifecycle` column                                                 | Derived at query time from phase presence in `content_md`                  | Persist once query cost matters -- currently trivial.                                                            |
| `content_hash` + `source_build_id` + `knowledge_build` audit table | Not present                                                                | Add when authoring-at-scale benefits from "who / when / what build wrote this node" audit trail.                 |
| `knowledge_content_phase` table (per-phase rows)                   | All phases packed into `content_md`; render-time H2 splitter extracts them | Denormalize per phase once per-phase queries (coverage reports, dashboards) outgrow render-time parsing.         |
| `study.card.content_phase`                                         | Not added in v1                                                            | Add when UI grouping by phase (vs. grouping by node_id alone) delivers authoring or learning signal.             |
| `study.scenario.node_id` + `content_phase`                         | Not added in v1 (scenarios stay decoupled)                                 | Add when scenarios need to aggregate into node mastery via the `repGate`. Stub `repGate = not_applicable` in v1. |

The **build script on main** (`bun run build-knowledge`, `scripts/build-knowledge-index.ts`) follows the spec's pipeline but writes into the v1 shape: parse `course/knowledge/**/node.md`, split the body into H2-keyed phases in memory, upsert `knowledge_node` with full metadata + raw `content_md`, replace outbound `knowledge_edge` rows, refresh `target_exists`. Validation (required fields, DAG on `requires`, duplicate id detection, unknown H2 detection) matches the spec. Coverage (`byLifecycle`, `byDomain`, `phaseGaps`) is computed per-build and written to `course/knowledge/graph-index.md` for authors but is not persisted in a DB audit table.

**Card authoring workflow (inline YAML):** Practice-phase cards are authored inline inside each `node.md` as a fenced block with the info string `yaml-cards`:

```yaml-cards
- front: "..."
  back: "..."
  cardType: basic
  tags: []
```

`bun run knowledge:seed --user <email>` (`scripts/knowledge-seed.ts`) materializes these as `study.card` rows with `node_id` set, `source_type = 'course'`, `is_editable = false`. Wholesale-replaces any existing course cards for the (user, node) pair so re-running is idempotent. Personal cards (`source_type = 'personal'`) are never touched. When a node's authored card count exceeds ~15 this will be split into a separate `cards/*.yaml` file per node; that split is a v2 concern.

The `bun run knowledge:new <domain> <slug>` scaffolder (`scripts/knowledge-new.ts`) emits a skeleton node.md with TODO-commented frontmatter fields and the seven H2 phase stubs -- the canonical starting point when authoring a new node.

## Data Model

All tables in the `study` Postgres schema namespace. IDs use `prefix_ULID` via `@ab/utils` `createId()`. The graph's human-authored identifier (the kebab-case YAML `id` field like `airspace-vfr-weather-minimums`) is carried alongside the internal ULID on a `slug` column so existing markdown, edges, and references remain stable across rebuilds.

### study.knowledge_node

Canonical graph node. One row per `course/knowledge/**/node.md` file. Created/upserted by `bun run build-knowledge`.

| Column                  | Type        | Constraints                              | Notes                                                                                                                    |
| ----------------------- | ----------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| id                      | text        | PK                                       | `kn_` prefix -- internal ULID, stable across renames of the slug                                                         |
| slug                    | text        | NOT NULL, UNIQUE                         | Kebab-case YAML id (e.g., `airspace-vfr-weather-minimums`). Authoring-facing.                                            |
| title                   | text        | NOT NULL                                 | Human-readable node name                                                                                                 |
| domain                  | text        | NOT NULL, CHECK in `DOMAINS`             | Primary domain (matches `libs/constants/src/study.ts` `DOMAINS`)                                                         |
| cross_domains           | jsonb       | NOT NULL, DEFAULT '[]'                   | Array of domain slugs also relevant                                                                                      |
| knowledge_types         | jsonb       | NOT NULL, DEFAULT '[]'                   | Array from `KNOWLEDGE_TYPES` (factual, conceptual, procedural, judgment, perceptual, pedagogical)                        |
| technical_depth         | text        | NOT NULL, CHECK in `TECHNICAL_DEPTHS`    | surface, working, deep                                                                                                   |
| stability               | text        | NOT NULL, CHECK in `NODE_STABILITIES`    | stable, evolving, volatile                                                                                               |
| relevance               | jsonb       | NOT NULL, DEFAULT '[]'                   | Array of `{ cert, bloom, priority }` objects; see validation                                                             |
| modalities              | jsonb       | NOT NULL, DEFAULT '[]'                   | Array from `NODE_MODALITIES`                                                                                             |
| estimated_time_minutes  | integer     | NULL, CHECK >= 0                         | Full learning experience duration (author estimate)                                                                      |
| review_time_minutes     | integer     | NULL, CHECK >= 0                         | Refresher duration (author estimate)                                                                                     |
| `references`            | jsonb       | NOT NULL, DEFAULT '[]'                   | Array of `{ source, detail, note }`                                                                                      |
| assessable              | boolean     | NOT NULL, DEFAULT true                   |                                                                                                                          |
| assessment_methods      | jsonb       | NOT NULL, DEFAULT '[]'                   | Array from `ASSESSMENT_METHODS`                                                                                          |
| mastery_criteria        | text        | NULL                                     | Markdown -- optional per-node override of platform default                                                                |
| content_path            | text        | NOT NULL                                 | Repo-relative path to `node.md` (e.g., `course/knowledge/airspace/vfr-weather-minimums/node.md`)                         |
| lifecycle               | text        | NOT NULL, CHECK in `NODE_LIFECYCLES`     | skeleton, started, complete -- derived on build from content-phase presence, persisted for query convenience             |
| content_hash            | text        | NOT NULL                                 | SHA-256 of the canonical node file (frontmatter + body). Used by the build to detect changes and avoid gratuitous writes |
| source_build_id         | text        | NOT NULL                                 | FK `study.knowledge_build.id` -- which build wrote this row                                                              |
| created_at              | timestamptz | NOT NULL, DEFAULT now()                  |                                                                                                                          |
| updated_at              | timestamptz | NOT NULL, DEFAULT now()                  |                                                                                                                          |

### study.knowledge_edge

Typed directed edge between two nodes. Populated by the build script from node frontmatter (`requires`, `deepens`, `applied_by`, `taught_by`, `related`).

| Column       | Type        | Constraints                                              | Notes                                                                          |
| ------------ | ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| id           | text        | PK                                                       | `kne_` prefix                                                                  |
| from_node_id | text        | NOT NULL, FK `study.knowledge_node.id` ON DELETE CASCADE |                                                                                |
| to_node_id   | text        | NOT NULL, FK `study.knowledge_node.id` ON DELETE CASCADE |                                                                                |
| edge_type    | text        | NOT NULL, CHECK in `EDGE_TYPES`                          | requires, deepens, applies, teaches, related                                   |
| metadata     | jsonb       | NOT NULL, DEFAULT '{}'                                   | Optional per-edge notes -- currently unused, reserved for "why" or "rationale" |
| created_at   | timestamptz | NOT NULL, DEFAULT now()                                  |                                                                                |

Unique constraint: `(from_node_id, to_node_id, edge_type)`. Indexes: `(from_node_id, edge_type)`, `(to_node_id, edge_type)`.

Edge directionality (normalized so graph queries are uniform):

| Frontmatter on source node | Stored as                                        |
| -------------------------- | ------------------------------------------------ |
| `requires: [X]`            | `from=self, to=X, type=requires`                 |
| `deepens: [X]`             | `from=self, to=X, type=deepens`                  |
| `applied_by: [X]`          | `from=X, to=self, type=applies` (reversed)       |
| `taught_by: [X]`           | `from=X, to=self, type=teaches` (reversed)       |
| `related: [X]`             | `from=self, to=X, type=related` (and the mirror) |

`related` is bidirectional: the build inserts both directions. All other edges are directional.

### study.knowledge_content_phase

Per-node content for each of the seven phases. One row per (node, phase) pair. NULL rows are authoring gaps.

| Column         | Type        | Constraints                             | Notes                                              |
| -------------- | ----------- | --------------------------------------- | -------------------------------------------------- |
| id             | text        | PK                                      | `knp_` prefix                                      |
| node_id        | text        | NOT NULL, FK `study.knowledge_node.id`  |                                                    |
| phase          | text        | NOT NULL, CHECK in `CONTENT_PHASES`     | context, problem, discover, reveal, practice, connect, verify |
| body           | text        | NULL                                    | Markdown body for the phase                        |
| payload        | jsonb       | NOT NULL, DEFAULT '{}'                  | Structured extras (questions, activity ids, card ids, rep ids, calculation prompts) |
| created_at     | timestamptz | NOT NULL, DEFAULT now()                 |                                                    |

Unique constraint: `(node_id, phase)`. A node is `complete` when all seven phases have a non-null `body` or non-empty `payload`.

### study.knowledge_build

Audit row per `bun run build-knowledge` invocation. Supports rollback and "which build produced this state" queries.

| Column          | Type        | Constraints             | Notes                                        |
| --------------- | ----------- | ----------------------- | -------------------------------------------- |
| id              | text        | PK                      | `knb_` prefix                                |
| started_at      | timestamptz | NOT NULL, DEFAULT now() |                                              |
| finished_at     | timestamptz | NULL                    | NULL during an in-flight build               |
| status          | text        | NOT NULL                | running, success, failed                     |
| node_count      | integer     | NOT NULL, DEFAULT 0     |                                              |
| edge_count      | integer     | NOT NULL, DEFAULT 0     |                                              |
| coverage        | jsonb       | NOT NULL, DEFAULT '{}'  | Summary: % phases filled, orphan nodes, etc. |
| error           | text        | NULL                    | Validation or IO error detail                |

### Additive changes to existing tables

Backward-compatible -- all NULL means "personal content, not graph-linked", preserving the spaced-memory-items and decision-reps shipped behavior.

`study.card`:

| Column          | Type | Constraints                                              | Notes                                                                                      |
| --------------- | ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| node_id         | text | NULL, FK `study.knowledge_node.id` ON DELETE SET NULL    | Links card to a knowledge node. NULL = personal card. Indexed for per-node mastery queries |
| content_phase   | text | NULL, CHECK in `CONTENT_PHASES` OR NULL                  | Which phase this card belongs to (usually `practice`). NULL when `node_id` is NULL         |

`study.scenario`:

| Column          | Type | Constraints                                              | Notes                                                                                       |
| --------------- | ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| node_id         | text | NULL, FK `study.knowledge_node.id` ON DELETE SET NULL    | Links scenario to a node. NULL = personal scenario                                          |
| content_phase   | text | NULL, CHECK in `CONTENT_PHASES` OR NULL                  | Usually `verify` (assessment scenario) or `practice` (rep). NULL when `node_id` is NULL     |

No migration of existing rows. Existing personal cards/scenarios stay `node_id = NULL`.

## File Layout (authoring)

```text
course/
  knowledge/
    domains.md                         # domain taxonomy + descriptions (authored prose, not built into DB)
    graph-index.md                     # auto-generated on build: all nodes, lifecycle, coverage
    airspace/
      vfr-weather-minimums/
        node.md                        # YAML frontmatter + 7 H2 sections per phase
        assets/                        # per-node images / diagrams (repo-relative paths)
          cloud-clearance.svg
      classes-and-dimensions/
        node.md
    weather/
      reading-metars-tafs/node.md
      thunderstorm-hazards/node.md
    ...
```

`node.md` format:

```text
---
# YAML frontmatter -- see "Node metadata" section below
id: airspace-vfr-weather-minimums
title: VFR Weather Minimums by Airspace Class
domain: airspace
...
---

## Context
<markdown>

## Problem
<markdown>

## Discover
<markdown + embedded YAML for activities: - activity: wind-triangle>

## Reveal
<markdown>

## Practice
<markdown>
<!-- build may splice in: cards: [crd_..., crd_...]  reps: [rep_...] -->

## Connect
<markdown>

## Verify
<markdown>
```

The build script parses the frontmatter, splits the body on `## {PhaseName}` headings, and stores each phase as a row. Unknown headings are an error.

## Behavior

### Build pipeline -- `bun run build-knowledge`

1. Insert a `knowledge_build` row with `status='running'`.
2. Glob `course/knowledge/**/node.md`.
3. For each file: parse YAML frontmatter, split body into phases, compute `content_hash`.
4. **Validate** (see Validation section). On any error: mark build `failed`, record `error`, exit non-zero, leave DB untouched. Validation is all-or-nothing.
5. In a single transaction:
   - Upsert `knowledge_node` by `slug`. Update only if `content_hash` changed. Set `source_build_id` to this build.
   - Delete `knowledge_edge` rows where `from_node_id` belongs to a touched node; reinsert edges from frontmatter. Edges are fully rebuilt per-build (simpler than incremental diffing; volume is low).
   - Upsert `knowledge_content_phase` rows. A missing phase section yields no row (not a NULL row) so `lifecycle` can be derived cleanly.
   - Recompute `lifecycle` per node: `skeleton` (zero phase rows), `started` (1-6 phase rows), `complete` (all 7 phase rows).
6. Write `graph-index.md` (autogenerated) summarizing all nodes, lifecycle, and coverage gaps.
7. Mark build `success`, set `finished_at`, `node_count`, `edge_count`, `coverage`.

Idempotent: re-running with no file changes makes no DB writes (each node hash matches).

### CLI

`bun run build-knowledge` (entry in `apps/study/package.json` forwards to `scripts/build-knowledge-index.ts`):

| Flag                  | Effect                                                         |
| --------------------- | -------------------------------------------------------------- |
| (default)             | Validate + write to DB                                         |
| `--dry-run`           | Validate only; print summary; no DB writes                     |
| `--json`              | Emit build summary as JSON on stdout (for CI)                  |
| `--fail-on-coverage`  | Exit non-zero if any node is `skeleton` (useful once scaled)   |

Pre-build `bun run check` hook wires `build-knowledge --dry-run` into the pre-commit pipeline. The study app's server start does NOT run the build automatically -- authoring is explicit.

### Node detail page -- `GET /knowledge/[slug]`

Load:

1. Resolve slug -> `knowledge_node` row. 404 if missing.
2. Fetch all seven `knowledge_content_phase` rows (even absent ones -- represent gaps).
3. Fetch incoming + outgoing edges grouped by type.
4. Fetch attached card ids and rep ids (via `node_id` match), compute mastery aggregates via existing `getCardMastery` / `getRepAccuracy` read interfaces (extended to accept `nodeId`).
5. Return `{ node, phases, edges: { requires, deepens, applies, teaches, related }, mastery, relatedNodes }`.

Render order (matches PRD mockup): header + domain tags + mastery bar, cert relevance table, prerequisites list, applies-in list, taught-by list, content phases with availability indicators, references, primary CTA "Start learning this node" / secondary "Just review cards".

Clicking "Start learning this node" opens `GET /knowledge/[slug]/learn` -- see below.

### Guided learning flow -- `GET /knowledge/[slug]/learn`

One page, seven internal steps (progress bar "Phase N of 7"). Each step renders the phase body (markdown -> HTML) + any payload (embedded activities by id, card drills, calculation prompts). Phase navigation is client-side (prev / next). Phases with no body and no payload are shown as "Not yet authored" placeholders but remain skippable. No attempt records are written from this view in v1 -- it's a reading/guided experience. Practice cards are reviewed via the existing `/memory/review` flow, keyed by `node_id` filter.

### Knowledge browse page -- `GET /knowledge`

Lists all nodes grouped by domain. Filter by cert (PPL / IR / CPL / CFI), priority (core / supporting / elective), lifecycle (skeleton / started / complete), coverage gap. Intended as the map view until the separate Learning Dashboard PRD ships.

### Seed-node authoring workflow

1. Author runs `bun run knowledge:new airspace vfr-weather-minimums`. Script scaffolds `course/knowledge/airspace/vfr-weather-minimums/node.md` with a frontmatter template (all fields present, commented where unknown) + empty `## Context` / `## Problem` / ... skeleton.
2. Author fills in the frontmatter (domain, relevance, requires/related, references).
3. Author fills in content phases as they study. Partial is fine.
4. Author runs `bun run build-knowledge --dry-run` to see validation feedback.
5. Clean dry-run -> commit. Next `build-knowledge` picks it up.

No in-app authoring UI in v1. The editor is VS Code. CLAUDE.md's "markdown-first, DB-built" is the principle.

### BC surface -- `libs/bc/study/`

New file `libs/bc/study/src/knowledge.ts`:

| Function                       | Signature                                                                               | Notes                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `getNode`                      | `(db, slug: string) -> (KnowledgeNode & { phases: ContentPhase[] }) \| null`            | Phases returned for all seven keys; absent phases are `null` |
| `getNodeById`                  | `(db, id: string) -> KnowledgeNode \| null`                                             | ULID variant                                               |
| `getNodeEdges`                 | `(db, nodeId: string) -> { outgoing: EdgeRow[], incoming: EdgeRow[] }`                  | Grouped by edge_type by caller if desired                  |
| `getPrerequisiteChain`         | `(db, nodeId: string, maxDepth?: number) -> KnowledgeNode[]`                            | Transitive closure over `requires`; default depth 5        |
| `getNodesByDomain`             | `(db, domain: Domain, filters?: { cert?; priority?; lifecycle? }) -> KnowledgeNode[]`   | Powers browse page                                         |
| `getNodesByCert`               | `(db, cert: Cert) -> KnowledgeNode[]`                                                   | Filters by relevance entries                               |
| `getNodeMastery`               | `(db, userId: string, nodeId: string) -> NodeMasteryStats`                              | Dual-gate mastery. See "Mastery computation" below.        |
| `listNodes`                    | `(db, filters?) -> KnowledgeNode[]`                                                     | Generic list with filter chain                             |
| `getCoverageReport`            | `(db) -> { totalNodes, byLifecycle, byDomain, phaseGaps }`                              | For the auto-generated `graph-index.md`                    |

Build-script-only (not exported from `libs/bc/study/src/index.ts`):

| Function          | Signature                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| `upsertBuild`     | `(db, build: NewKnowledgeBuild) -> string`                             |
| `finalizeBuild`   | `(db, buildId: string, summary) -> void`                               |
| `upsertNode`      | `(db, node: ParsedNode, buildId: string) -> string`                    |
| `replaceEdges`    | `(db, nodeId: string, edges: ParsedEdge[]) -> void`                    |
| `upsertPhases`    | `(db, nodeId: string, phases: ParsedPhase[]) -> void`                  |

Extensions to existing files:

- `libs/bc/study/src/stats.ts`: `getCardMastery(userId, { domain?, nodeId? })` and `getRepAccuracy(userId, { domain?, nodeId? })` accept a `nodeId` filter.
- `libs/bc/study/src/cards.ts`: `createCard`/`updateCard` accept optional `nodeId` + `contentPhase`. Validation: both NULL or both present.
- `libs/bc/study/src/scenarios.ts` (shipped in decision-reps): same optional fields.

Errors (throwing classes, match existing BC style):

- `KnowledgeNodeNotFoundError`
- `KnowledgeBuildValidationError` (aggregates violations)
- `KnowledgeCycleError` (carries the offending node slugs)
- `InvalidContentPhaseError`

### Mastery computation (dual gate)

Mastery is a **dual gate**: card stability AND rep accuracy must each independently clear their threshold. Aviation culture rejects "good enough" composites -- you either know stalls or you don't. A weighted average can hide a weak pillar (e.g., 90% card recall + 50% rep accuracy == 0.74 weighted, but the pilot doesn't know how to apply the knowledge). Dual-gate forces both pillars to mature before a node is called "mastered".

`NodeMasteryStats` returned by `getNodeMastery`:

```typescript
type NodeMasteryStats = {
  cardsTotal: number;
  cardsMastered: number;            // FSRS stability > STABILITY_MASTERED_DAYS
  cardsDue: number;
  cardsMasteredRatio: number;       // cardsMastered / cardsTotal, 0 if no cards
  repsTotal: number;
  repsCorrect: number;
  repAccuracy: number;              // repsCorrect / repsTotal, 0 if no reps
  mastered: boolean;                // dual-gate output
  displayScore: number;             // 0..1 for progress bars
  cardGate: 'pass' | 'fail' | 'insufficient_data';
  repGate:  'pass' | 'fail' | 'insufficient_data' | 'not_applicable';
};
```

**Gate rules:**

- `cardGate = pass` iff `cardsTotal >= CARD_MIN && cardsMasteredRatio >= CARD_MASTERY_RATIO_THRESHOLD`
- `cardGate = insufficient_data` iff `cardsTotal < CARD_MIN` (and `cardsTotal > 0`)
- `cardGate = fail` otherwise
- `repGate = pass` iff `repsTotal >= REP_MIN && repAccuracy >= REP_ACCURACY_THRESHOLD`
- `repGate = insufficient_data` iff `0 < repsTotal < REP_MIN`
- `repGate = not_applicable` iff `repsTotal == 0` AND no scenarios are attached to this node (graph-checked)
- `repGate = fail` otherwise

**Mastered rule:**

- If `cardGate == pass` AND (`repGate == pass` OR `repGate == not_applicable`): `mastered = true`
- Else: `mastered = false`

Knowledge-only nodes (no scenarios exist) pass the rep gate automatically via `not_applicable`. Judgment-only nodes (no cards exist) require `repGate == pass` and treat `cardGate == not_applicable` symmetrically. Nodes with no attached content are never mastered.

**Display score** (for progress bars, never for the mastered boolean):

- Both pillars present: `(cardsMasteredRatio + repAccuracy) / 2`
- Cards only: `cardsMasteredRatio`
- Reps only: `repAccuracy`
- Neither: `0`

**Platform constants** (`libs/constants/src/study.ts`):

| Constant                       | Value | Rationale                                                                            |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------ |
| `CARD_MASTERY_RATIO_THRESHOLD` | 0.80  | 4-of-5 attached cards mature -- enough to trust stability                            |
| `REP_ACCURACY_THRESHOLD`       | 0.70  | Judgment tolerates one miss in three; lower than card recall because reps are harder |
| `CARD_MIN`                     | 3     | Floor before the card gate can pass; prevents "mastered with 1 card"                 |
| `REP_MIN`                      | 3     | Floor before the rep gate can pass                                                   |
| `STABILITY_MASTERED_DAYS`      | 30    | FSRS stability threshold for a single card being "mastered"                          |

Per-node `mastery_criteria` stays a markdown note in v1 -- a human-readable caveat ("this node is hard to assess discretely; focus on scenario judgment"). Not an executable override. v2 can promote the constants to per-node YAML once the defaults have been lived with.

**Reconciliation notes:**

- Study Plan + Session Engine's `isNodeMastered(userId, nodeId)` is a boolean projection of `getNodeMastery(...).mastered`.
- Study Plan's `getNodeMastery(...) -> { score, trend }` resolves: `score = displayScore`, `trend` is the 14-day delta of `displayScore` computed from the review + rep history.
- Dashboard's `getDomainCertMatrix` and `getCertProgress` aggregate the boolean `mastered` across nodes in scope.

## Constants (`libs/constants/src/knowledge.ts`)

Separate file from `study.ts` to keep the graph taxonomy distinct from the tool constants. Re-exported from `libs/constants/src/index.ts`.

| Constant                   | Purpose                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `CERTS`                    | `{ PPL: 'PPL', IR: 'IR', CPL: 'CPL', CFI: 'CFI' }`                                    |
| `BLOOM_LEVELS`             | `{ REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE }`                          |
| `RELEVANCE_PRIORITIES`     | `{ CORE: 'core', SUPPORTING: 'supporting', ELECTIVE: 'elective' }`                    |
| `KNOWLEDGE_TYPES`          | `{ FACTUAL, CONCEPTUAL, PROCEDURAL, JUDGMENT, PERCEPTUAL, PEDAGOGICAL }`              |
| `TECHNICAL_DEPTHS`         | `{ SURFACE, WORKING, DEEP }`                                                          |
| `NODE_STABILITIES`         | `{ STABLE, EVOLVING, VOLATILE }`                                                      |
| `NODE_MODALITIES`          | `{ READING, CARDS, REPS, DRILL, VISUALIZATION, AUDIO, VIDEO, CALCULATION, TEACHING_EXERCISE }` |
| `ASSESSMENT_METHODS`       | `{ RECALL, CALCULATION, SCENARIO, DEMONSTRATION, TEACHING }`                          |
| `EDGE_TYPES`               | `{ REQUIRES, DEEPENS, APPLIES, TEACHES, RELATED }`                                    |
| `CONTENT_PHASES`           | `{ CONTEXT, PROBLEM, DISCOVER, REVEAL, PRACTICE, CONNECT, VERIFY }`                   |
| `CONTENT_PHASE_ORDER`      | Ordered array: `[CONTEXT, PROBLEM, DISCOVER, REVEAL, PRACTICE, CONNECT, VERIFY]`      |
| `NODE_LIFECYCLES`          | `{ SKELETON: 'skeleton', STARTED: 'started', COMPLETE: 'complete' }`                  |
| `NODE_ID_PREFIX`           | `'kn'`                                                                                |
| `KNOWLEDGE_EDGE_ID_PREFIX` | `'kne'`                                                                               |
| `KNOWLEDGE_PHASE_ID_PREFIX`| `'knp'`                                                                               |
| `KNOWLEDGE_BUILD_ID_PREFIX`| `'knb'`                                                                               |
| `KNOWLEDGE_MAX_PREREQ_DEPTH` | `5`                                                                                 |

All existing `DOMAINS` in `libs/constants/src/study.ts` are reused as-is.

## Routes (`libs/constants/src/routes.ts`)

Additions:

```typescript
// Knowledge graph
KNOWLEDGE: '/knowledge',
KNOWLEDGE_NODE: (slug: string) => `/knowledge/${slug}` as const,
KNOWLEDGE_NODE_LEARN: (slug: string) => `/knowledge/${slug}/learn` as const,
```

## Validation (build script)

All violations aggregate into a single `KnowledgeBuildValidationError`. The build reports every failure in one pass rather than stopping on the first.

| Rule                                                                       | Severity |
| -------------------------------------------------------------------------- | -------- |
| Every node has a non-empty `id`, `title`, `domain`                          | error    |
| `id` (slug) matches `^[a-z][a-z0-9-]*$` and is unique across all nodes      | error    |
| `domain` in `DOMAINS`                                                       | error    |
| Every entry in `cross_domains` in `DOMAINS`                                 | error    |
| Every value in `knowledge_types` in `KNOWLEDGE_TYPES`                        | error    |
| `technical_depth` in `TECHNICAL_DEPTHS`                                     | error    |
| `stability` in `NODE_STABILITIES`                                           | error    |
| Every `relevance` entry has `cert` in `CERTS`, `bloom` in `BLOOM_LEVELS`, `priority` in `RELEVANCE_PRIORITIES` | error |
| `relevance` entries unique on `(cert, bloom)` per node                      | error    |
| All `requires` / `deepens` / `applied_by` / `taught_by` / `related` slugs resolve to an existing node | error |
| The `requires` subgraph is a DAG -- no cycles                               | error    |
| `modalities` entries in `NODE_MODALITIES`                                   | error    |
| `assessment_methods` entries in `ASSESSMENT_METHODS`                        | error    |
| `references` entries have non-empty `source`                                | error    |
| Phase headings in `node.md` body are drawn from `CONTENT_PHASES`, each at most once | error |
| Every referenced activity id resolves to `libs/activities/{id}/` (once activities land) | warning in v1 (no activities lib yet except optional `wind-triangle`) |
| Every referenced card/rep id resolves to an existing DB row                  | warning  |
| A node has at least one `relevance` entry (otherwise it's orphaned across all certs) | warning |
| No duplicate edges `(from, to, type)`                                        | error    |

Warnings print but do not fail the build unless `--fail-on-warnings` is passed.

## Out of Scope (v1)

v1 is the 30-node skeleton per ADR 011. Everything below ships later.

- **Scaling to 100 / 300 / 500 nodes.** v1 proves the model; content volume is a separate phase.
- **Authoring UI.** VS Code + markdown is the authoring surface for v1. Hangar-based authoring lands when `apps/hangar/` exists.
- **Graph-as-graph visualization.** v1 is tables grouped by domain. Force-directed / node-link layouts are a later experiment.
- **AI-assisted node drafting.** Skeleton generation from a topic prompt is explicitly deferred.
- **Node versioning / drift detection.** When a regulation changes, flagging stale nodes is future work. v1 timestamps nodes and records builds; it does not version them.
- **Cross-edition reference tracking.** PHAK/AIM edition churn is handled manually in v1.
- **Community contribution.** Single-author workflow (Joshua as user zero) in v1.
- **Courses as views.** The course filter schema (`cert_filter`, `priority_filter`, `coverage_requirement`, `assessment_gates`) is specced in ADR 011 but ships with FIRC migration, not this feature.
- **Session engine / study plan wiring.** That's the next work package. v1 exposes the read functions they need but doesn't implement picking.
- **Migration of FIRC content onto nodes.** Happens during FIRC migration phase.
- **Scale concerns (documented for awareness, not v1):**
  - At 500 nodes, edge table grows to a few thousand rows (trivial for Postgres but warrants B-tree indexes on `from_node_id`, `to_node_id`).
  - Graph validation (cycle detection, slug resolution) is O(N + E) per build. Remains sub-second at 500 nodes but the build needs streaming output if it crosses a few seconds.
  - The per-build "replace all edges for touched nodes" strategy is fine at 500; at 5000+ nodes consider diffing edge sets.
  - `getPrerequisiteChain` uses a recursive CTE capped at `KNOWLEDGE_MAX_PREREQ_DEPTH`. Deep chains will need a cache layer.
  - Markdown parsing (frontmatter + body split) is per-file and parallelizable. Not parallelized in v1.

## Open Questions

Decisions Joshua must confirm before sign-off. These are tracked here rather than silently chosen so nothing load-bearing is buried.

1. **`kn_` prefix for node ULID.** Proposed: `kn_` (node), `kne_` (edge), `knp_` (phase), `knb_` (build). Two characters for the parent, three for children to stay distinct in grep. OK, or prefer a different scheme?
2. **`slug` uniqueness across the whole graph vs per-domain.** Proposed: globally unique slugs (mirrors ADR 011 example IDs like `airspace-vfr-weather-minimums`). Per-domain would allow shorter slugs but risk cross-references being ambiguous. Global chosen unless objection.
3. **`node.md` body format: H2-per-phase vs YAML block for phases.** Proposed: H2 headings (`## Context`, `## Problem`, etc.) for readability in GitHub/VS Code. ADR 011 showed a `content:` YAML block for the structured payload; the spec reconciles by keeping markdown prose under H2s and reserving small YAML fences inside `## Discover` and `## Practice` for lists of activity/card/rep ids. Confirm this split.
4. **Hybrid storage (markdown source of truth, DB mirror) vs DB-as-source.** Proposed: markdown is canonical; the DB is a built projection. This matches CLAUDE.md's "discovery-first pedagogy" and "markdown-first, DB-built" rule in the PRD. DB is rebuildable from the filesystem. The opposite (DB-as-source with markdown export) is the alternative; not chosen because it would put authoring in a UI v1 doesn't have. Confirm.
5. **Domain authority: `DOMAINS` constant vs `course/knowledge/domains.md`.** ADR 011 says the graph is the source of truth and the constant should mirror it. For v1 the constant stays authoritative (it already drives `study.card`, `study.scenario`, and the browse filter); `domains.md` is human prose. Revisit once the graph scales and domain changes become common.
6. **`assessable: boolean` at node level.** Some factual nodes are assessable (question-answer). Some nodes (like `teach-the-learning-process`) are harder to assess discretely. Proposed: default `true`, author can flip to `false` with a rationale in `mastery_criteria`. Confirm vs removing the field entirely in v1.
7. **"Related" bidirectional mirror.** Proposed: the build inserts both directions for a `related` edge even if only one side lists it. This simplifies queries but means one-sided author intent turns into two-sided data. Alternative: store as-authored and let queries UNION. Confirm.
8. **[RESOLVED 2026-04-19]** Mastery is a **dual gate**: card stability AND rep accuracy must each independently clear their threshold. Not a weighted average -- aviation culture rejects "good enough" composites. See "Mastery computation" section below. Per-node `mastery_criteria` stays a markdown note in v1; the dual-gate thresholds are platform constants in `libs/constants/study.ts`, authored once.
9. **Interactive activity location for v1.** `libs/activities/` is called out in ADR 011 but doesn't exist yet. Proposed: create `libs/activities/wind-triangle/` alongside this feature for the one deep-dive node (`perf-crosswind-component`). Confirm vs embedding the activity inline in the study app routes.
10. **Which 3-5 nodes are "deep dives."** ADR 011 proposes five candidates. Proposed: deep-build exactly three for v1 -- `airspace-vfr-weather-minimums` (discovery example), `perf-crosswind-component` (interactive widget), `proc-engine-failure-after-takeoff` (judgment-rich). The remaining two from the ADR list become stretch. Confirm.

## References

- [Knowledge Graph PRD](PRD.md)
- [ADR 011 decision](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [ADR 011 context](../../decisions/011-knowledge-graph-learning-system/context.md)
- [Spaced Memory Items spec](../spaced-memory-items/spec.md) -- `node_id` is added to `study.card`
- [Decision Reps spec](../decision-reps/spec.md) -- `node_id` is added to `study.scenario`
- [Design](./design.md) -- rationale behind these choices
- [Tasks](./tasks.md) -- phased implementation plan
- [Test plan](./test-plan.md) -- manual acceptance
