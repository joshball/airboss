---
title: 'Tasks: Knowledge Graph'
product: study
feature: knowledge-graph
type: tasks
status: unread
review_status: pending
---

# Tasks: Knowledge Graph

Depends on: Spaced Memory Items (shipped), Decision Reps (must ship before this feature; schema drives `scenario.node_id` addition).

## Pre-flight

- [ ] Confirm Decision Reps feature shipped -- `study.scenario` and `study.rep_attempt` exist in DB.
- [ ] Read `libs/bc/study/src/schema.ts` -- understand existing tables and CHECK-constraint pattern.
- [ ] Read `libs/bc/study/src/index.ts` -- understand BC export conventions.
- [ ] Read `libs/constants/src/study.ts` and `libs/constants/src/index.ts` -- pattern for constants + re-export.
- [ ] Read `libs/constants/src/schemas.ts` and `libs/constants/src/routes.ts` -- where SCHEMAS and ROUTES live.
- [ ] Read `libs/utils/src/ids.ts` -- ID generation pattern.
- [ ] Read `docs/work-packages/knowledge-graph/spec.md` and `design.md` in full.
- [ ] Read `docs/work-packages/knowledge-graph/test-plan.md` -- keep acceptance tests in mind while implementing.
- [ ] Confirm Open Questions 1-10 in spec.md are resolved by Joshua; apply any changes before starting implementation.
- [ ] Verify DB is running (OrbStack postgres on port 5435).

## Implementation

### 1. Constants

- [ ] Create `libs/constants/src/knowledge.ts` with `CERTS`, `BLOOM_LEVELS`, `RELEVANCE_PRIORITIES`, `KNOWLEDGE_TYPES`, `TECHNICAL_DEPTHS`, `NODE_STABILITIES`, `NODE_MODALITIES`, `ASSESSMENT_METHODS`, `EDGE_TYPES`, `CONTENT_PHASES`, `CONTENT_PHASE_ORDER`, `NODE_LIFECYCLES`, `NODE_ID_PREFIX`, `KNOWLEDGE_EDGE_ID_PREFIX`, `KNOWLEDGE_PHASE_ID_PREFIX`, `KNOWLEDGE_BUILD_ID_PREFIX`, `KNOWLEDGE_MAX_PREREQ_DEPTH`. Each constant also exports a `_VALUES` array and type.
- [ ] Re-export all of the above from `libs/constants/src/index.ts`.
- [ ] Add `KNOWLEDGE`, `KNOWLEDGE_NODE(slug)`, `KNOWLEDGE_NODE_LEARN(slug)` routes to `libs/constants/src/routes.ts`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 2. ID helpers

- [ ] Add `generateKnowledgeNodeId`, `generateKnowledgeEdgeId`, `generateKnowledgePhaseId`, `generateKnowledgeBuildId` to `libs/utils/src/ids.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 3. Drizzle schema additions

- [ ] Add `knowledgeNode`, `knowledgeEdge`, `knowledgeContentPhase`, `knowledgeBuild` tables to `libs/bc/study/src/schema.ts`:
  - CHECK constraints mirror the existing `inList(...)` pattern for enum-like columns.
  - Unique constraint on `knowledge_edge (from_node_id, to_node_id, edge_type)`.
  - Unique constraint on `knowledge_content_phase (node_id, phase)`.
  - Indexes: `knowledge_node_domain_idx`, `knowledge_node_lifecycle_idx`, `knowledge_edge_from_type_idx`, `knowledge_edge_to_type_idx`, `knowledge_content_phase_node_idx`.
- [ ] Add nullable `nodeId` and `contentPhase` columns to `card` and `scenario` tables with FK to `knowledgeNode.id` ON DELETE SET NULL, and matching CHECK constraints.
- [ ] Add `card_user_node_idx` and `scenario_user_node_idx` partial indexes (WHERE node_id IS NOT NULL) for mastery aggregation queries.
- [ ] Push schema: `bunx drizzle-kit push`.
- [ ] Verify all tables/columns/indexes exist in DB (inspect via `psql` or drizzle studio).
- [ ] Run `bun run check` -- 0 errors, commit.

### 4. Row types + BC validation helpers

- [ ] Export row types (`KnowledgeNodeRow`, `NewKnowledgeNodeRow`, `KnowledgeEdgeRow`, `NewKnowledgeEdgeRow`, `KnowledgeContentPhaseRow`, `KnowledgeBuildRow`) from `libs/bc/study/src/schema.ts`.
- [ ] Extend `libs/bc/study/src/validation.ts` with Zod schemas for frontmatter parsing: `knowledgeNodeFrontmatterSchema`, `knowledgeRelevanceEntrySchema`, `knowledgeReferenceSchema`, `knowledgeEdgeListSchema`.
- [ ] Run `bun run check` -- 0 errors.

### 5. Knowledge BC read functions

- [ ] Create `libs/bc/study/src/knowledge.ts` exporting read functions: `getNode`, `getNodeById`, `getNodeEdges`, `getPrerequisiteChain`, `getNodesByDomain`, `getNodesByCert`, `getNodeMastery`, `listNodes`, `getCoverageReport`.
  - `getPrerequisiteChain` uses a recursive CTE, capped at `KNOWLEDGE_MAX_PREREQ_DEPTH`.
  - `getNodeMastery` composes existing `getCardMastery` / `getRepAccuracy` with a `nodeId` filter.
- [ ] Create error classes in the same file: `KnowledgeNodeNotFoundError`, `KnowledgeBuildValidationError`, `KnowledgeCycleError`, `InvalidContentPhaseError`.
- [ ] Export the read functions + error classes from `libs/bc/study/src/index.ts`.
- [ ] Run `bun run check` -- 0 errors.

### 6. Extend card and scenario BC functions with node linkage

- [ ] Update `libs/bc/study/src/cards.ts` -- `CreateCardInput` accepts optional `nodeId` + `contentPhase`. Validate: both present or both NULL. Extend `getCardMastery` in `libs/bc/study/src/stats.ts` to accept `{ domain?, nodeId? }` filter.
- [ ] Update `libs/bc/study/src/scenarios.ts` (shipped by decision-reps) similarly. Extend `getRepAccuracy` with `nodeId` filter.
- [ ] Run `bun run check` -- 0 errors.

### 7. Knowledge BC unit tests

- [ ] Create `libs/bc/study/src/knowledge.test.ts`:
  - `getNode` returns node with all seven phase slots (null for absent phases).
  - `getPrerequisiteChain` returns transitive closure, dedupes, respects depth cap.
  - `getNodesByDomain` filters by domain.
  - `getNodesByCert` filters by relevance entries containing the cert.
  - `getNodeMastery` aggregates cards and reps correctly for a given `nodeId`.
  - `getCoverageReport` reports lifecycle + phase gap counts.
- [ ] Run `bun test libs/bc/study` -- all pass, commit.

### 8. Build script -- parsing

- [ ] Create `scripts/build-knowledge-index.ts` in the repo root scripts dir (matches existing script conventions).
- [ ] Implement parser: glob `course/knowledge/**/node.md`, read each file, split YAML frontmatter from body, split body on H2 phase headings. Compute `content_hash` (SHA-256 of raw file contents).
- [ ] Parse structured YAML fences inside `## Discover` (activities list) and `## Practice` (cards list, reps list, calculations). Reject unknown fence keys.
- [ ] Run `bun run check` -- 0 errors.

### 9. Build script -- validation

- [ ] Implement validation per the "Validation" table in spec.md. Accumulate all errors into a single `KnowledgeBuildValidationError`; do not stop on first failure.
- [ ] Implement `requires`-DAG cycle detection (DFS with color marking). Produce `KnowledgeCycleError` listing the offending slug chain.
- [ ] Support flags: `--dry-run`, `--json`, `--fail-on-coverage`, `--fail-on-warnings`.
- [ ] Run `bun run check` -- 0 errors.

### 10. Build script -- write pipeline

- [ ] Implement build-scoped functions inside `libs/bc/study/src/knowledge.ts` (not exported from the BC barrel): `upsertBuild`, `finalizeBuild`, `upsertNode`, `replaceEdges`, `upsertPhases`.
- [ ] Build script wires parse + validate + write:
  1. Insert `knowledge_build` row (status `running`).
  2. Validate all parsed nodes.
  3. In a single transaction: upsert nodes (skip unchanged by hash), replace edges for touched nodes, upsert phases. Derive and set `lifecycle`.
  4. Write `course/knowledge/graph-index.md` (autogenerated summary).
  5. Finalize the `knowledge_build` row.
- [ ] Wire `build-knowledge` script into the study app's `package.json` or the monorepo root: `"build-knowledge": "bun run scripts/build-knowledge-index.ts"`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 11. Build script unit tests

- [ ] Create `scripts/build-knowledge-index.test.ts` with fixture node trees in a temp dir:
  - Happy path: 3 nodes, 2 edges, phases parsed correctly.
  - Missing required field (domain) -> validation error.
  - Unknown edge target slug -> validation error.
  - Cycle in `requires` -> `KnowledgeCycleError`.
  - Duplicate phase heading in `node.md` -> error.
  - `--dry-run` makes no DB writes.
  - Rerunning with no changes is a no-op (content_hash match).
- [ ] Run `bun test` -- all pass.

### 12. Scaffolder -- `knowledge:new`

- [ ] Create `scripts/knowledge-new.ts` -- takes `<domain> <slug>` args, produces `course/knowledge/<domain>/<slug>/node.md` with full frontmatter template (all fields present, TODO-commented) + seven H2 section stubs.
- [ ] Refuse to overwrite an existing node file. Refuse unknown domain.
- [ ] Wire into package.json: `"knowledge:new": "bun run scripts/knowledge-new.ts"`.
- [ ] Run `bun run check` -- 0 errors.

### 13. Author the 30 seed nodes

- [ ] For each of the 30 nodes in [ADR 011 section "The 30-Node Experiment"](../../decisions/011-knowledge-graph-learning-system/decision.md): run `bun run db new <domain> <slug>`. Fill in frontmatter: `title`, `domain`, `cross_domains`, `knowledge_types`, `technical_depth`, `stability`, `relevance` array, `requires` / `deepens` / `applied_by` / `taught_by` / `related` lists, `modalities`, `estimated_time_minutes`, `review_time_minutes`, `references`, `assessable`, `assessment_methods`.
- [ ] Leave phase sections empty (`<!-- TODO -->` placeholders) for all 30 -- they ship as skeletons.
- [ ] Run `bun run db build --dry-run` -- expect 0 errors. Fix any frontmatter issues surfaced.
- [ ] Commit the 30 skeletons as one logical commit.

### 14. Deep-build 3 nodes

- [ ] For `airspace-vfr-weather-minimums`: fill Context, Problem, Discover, Reveal, Practice, Connect, Verify sections following the PRD's authored-state example. Practice phase lists card ids (to be created); Verify lists rep ids (to be created).
- [ ] For `perf-crosswind-component`: same, with Discover referencing the `wind-triangle` activity (see task 15).
- [ ] For `proc-engine-failure-after-takeoff`: same; judgment-rich, scenario-heavy Practice + Verify.
- [ ] Author 8-15 cards linked to each deep node (via `node_id` + `content_phase='practice'`). Manual creation via `/memory/new` with a new "Attach to node" field (see task 17) or a seed script.
- [ ] Author 3-5 scenarios linked to each deep node (Verify phase, `content_phase='verify'`). Same creation pattern via `/reps/new`.
- [ ] Run `bun run db build` -- deep nodes transition to `complete` lifecycle; 27 others remain `skeleton`. Commit.

### 15. Interactive activity: wind-triangle

- [ ] Create `libs/activities/` monorepo package (new lib, follow `libs/ui/` conventions).
- [ ] Create `libs/activities/wind-triangle/` with `WindTriangle.svelte`, `README.md` (what it teaches, parameters), `preview.png`.
- [ ] Wire `@ab/activities` path alias in root `tsconfig.json` and biome/drizzle configs.
- [ ] Build script validates that any `activity: <id>` payload references an actual directory under `libs/activities/`. In v1, missing activities are a warning (since most won't exist); add a `--strict-activities` flag for future use.
- [ ] Run `bun run check` -- 0 errors, commit.

### 16. Node detail route -- `/knowledge/[slug]`

- [ ] Add `(app)/knowledge/[slug]/+page.server.ts` -- load `getNode(slug)` + edges + mastery. 404 on missing slug.
- [ ] Add `(app)/knowledge/[slug]/+page.svelte` matching the PRD learner-view mockup: header, domain tags, mastery bar, cert relevance table, prerequisites, applies-in, taught-by, seven content-phase availability indicators, references, primary "Start learning this node" CTA, secondary "Just review cards" CTA.
- [ ] Use Svelte 5 runes only; no `$:` / `export let` / stores.
- [ ] Run `bun run check` -- 0 errors.

### 17. Guided learning route -- `/knowledge/[slug]/learn`

- [ ] Add `(app)/knowledge/[slug]/learn/+page.server.ts` -- load the node + seven phases.
- [ ] Add `(app)/knowledge/[slug]/learn/+page.svelte` -- client-side phase stepper with "Phase N of 7" progress bar, render phase body as markdown, embed activities by id (for now only `wind-triangle` imports), allow skip to any phase.
- [ ] Handle unauthored phases with a "Not yet authored" placeholder that still permits navigation.
- [ ] Run `bun run check` -- 0 errors, commit.

### 18. Knowledge browse route -- `/knowledge`

- [ ] Add `(app)/knowledge/+page.server.ts` -- `listNodes(filters)` with cert, priority, lifecycle filters.
- [ ] Add `(app)/knowledge/+page.svelte` -- grouped by domain, filters in a sidebar, lifecycle badge per node, links to detail page.
- [ ] Run `bun run check` -- 0 errors.

### 19. Attach-to-node in card and rep creation

- [ ] Extend `/memory/new/+page.svelte` to optionally pick a node and content phase. Render an autocomplete fed by `listNodes()`.
- [ ] Extend `/reps/new/+page.svelte` similarly.
- [ ] Server actions validate `nodeId` exists and `contentPhase` is in `CONTENT_PHASES`. If nodeId is provided, contentPhase must be provided.
- [ ] Run `bun run check` -- 0 errors.

### 20. Navigation wiring

- [ ] Add "Knowledge" nav item in `apps/study/src/routes/(app)/+layout.svelte` linking to `ROUTES.KNOWLEDGE`.
- [ ] Run `bun run check` -- 0 errors, commit.

### 21. Pre-commit hook

- [ ] Extend the repo's pre-commit pipeline (or `bun run check` composite) to run `bun run db build --dry-run`. Failure blocks commit.
- [ ] Document the build command in `CLAUDE.md` "Before You Build" stack reference.
- [ ] Run `bun run check` -- 0 errors, commit.

### 22. End-to-end smoke (Playwright)

- [ ] Add `apps/study/tests/knowledge-graph.spec.ts` covering: navigate to `/knowledge`, filter by domain, open a node detail page, verify mastery bar renders, click "Start learning this node", step through phases, return to detail.
- [ ] Run `bunx playwright test` -- pass.
- [ ] Run `bun run check` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual test per [test-plan.md](./test-plan.md).
- [ ] `bun run db build` produces a clean build; 30 nodes + edges + 3 complete lifecycle; no warnings (or only expected activity warnings).
- [ ] Verify `course/knowledge/graph-index.md` is checked in and matches latest build.
- [ ] Request implementation review via `/ball-review-full`.
- [ ] Address review findings.
- [ ] Update `docs/work/NOW.md` -- move knowledge-graph from active to shipped.
- [ ] Commit doc updates (PRD status, `docs/products/study/ROADMAP.md` entry, `docs/products/study/TASKS.md`).
