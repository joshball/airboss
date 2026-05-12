---
title: 'Out of Scope: Knowledge Graph'
product: study
feature: knowledge-graph
type: out-of-scope
status: unread
---

# Out of Scope: Knowledge Graph

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                                                                                                                                                                    | Status       | Trigger to revisit                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| Scaling to 100 / 300 / 500 nodes                                                                                                                                                                        | Deferred     | After v1 (30-node) model is proven and a content push is planned    |
| In-app authoring UI                                                                                                                                                                                     | Deferred     | When `apps/hangar/` exists and authoring volume exceeds VS Code     |
| Graph-as-graph visualization                                                                                                                                                                            | Deferred     | When users hit the limits of domain-grouped table browse            |
| AI-assisted node drafting                                                                                                                                                                               | Deferred     | When authoring throughput becomes the bottleneck                    |
| Node versioning + drift detection                                                                                                                                                                       | Deferred     | When a regulation change invalidates a shipped node                 |
| Cross-edition reference tracking                                                                                                                                                                        | Deferred     | When PHAK/AIM edition churn produces wrong-page citations           |
| Community contribution workflow                                                                                                                                                                         | Deferred     | When a second author needs write access to `course/knowledge/`      |
| Courses as views (cert / priority / coverage filter)                                                                                                                                                    | Follow-on WP | When FIRC migration begins (`apps/firc/`)                           |
| Session engine / study plan wiring                                                                                                                                                                      | Follow-on WP | Already in flight as a separate WP                                  |
| FIRC content migration onto nodes                                                                                                                                                                       | Follow-on WP | When FIRC migration phase begins                                    |
| Edge-table indexes + diff strategy (500+ nodes)                                                                                                                                                         | Deferred     | When `bun run db build` crosses ~5s or node count exceeds ~500      |
| `getPrerequisiteChain` cache layer                                                                                                                                                                      | Deferred     | When prereq queries on deep chains exceed perf budget               |
| Parallel markdown parsing                                                                                                                                                                               | Deferred     | When per-file parse time multiplied by node count blocks authoring  |
| v2 schema columns (`content_path`, `lifecycle` persisted, `content_hash`, `source_build_id`, `knowledge_build` audit table, per-phase rows, `card.content_phase`, `scenario.node_id` + `content_phase`) | Deferred     | When the v1-on-main shape blocks a concrete authoring or query need |

## Scaling to 100 / 300 / 500 nodes

Status: Deferred

What was deferred:
Authoring volume beyond the v1 30-node skeleton from [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md).

Why:
v1 proves the model -- schema, build pipeline, validation, mastery
gating, node detail / guided / browse routes. Scaling is a content
phase, not a platform phase. ADR 011 explicitly frames the 30-node
experiment as a proof step before broader content authoring.

Trigger to revisit:
The 30-node v1 has shipped, deep-dive nodes have been lived with, and
the user (or a second author) is ready to push content volume past 30.

Implementation pattern when triggered:
Reuse the v1 scaffolder (`bun run db new <domain> <slug>`) +
`bun run db build` pipeline. No code change required to get to ~100
nodes; the indexes + edge strategy below cover the next bound.

References:

- [ADR 011 decision](../../decisions/011-knowledge-graph-learning-system/decision.md) -- the 30-node experiment frame
- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note

## In-app authoring UI

Status: Deferred

What was deferred:
A web UI for creating / editing `course/knowledge/**/node.md` files.
The v1 authoring surface is VS Code + markdown + the
`bun run db new` scaffolder.

Why:
CLAUDE.md's "markdown-first, DB-built" rule (and the spec's "Hybrid
storage" open question, resolved markdown-canonical). v1 has a single
author (Joshua as user zero). Authoring through markdown + git is
faster than building a UI for one user.

Trigger to revisit:
`apps/hangar/` exists and a second author needs to contribute, or
authoring volume exceeds what VS Code-plus-`bun run db build` can
support comfortably.

Implementation pattern when triggered:
Hangar-based authoring per the multi-product architecture
(`apps/hangar/` is the content authoring surface). Mirror existing
hangar editing patterns once they land. The DB-as-projection model
already supports round-trip (hangar writes node files; build picks them
up), so no schema change needed.

References:

- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- hangar surface
- [spec.md](./spec.md) "Open Questions" #4 -- markdown-canonical decision

## Graph-as-graph visualization

Status: Deferred

What was deferred:
Force-directed / node-link / d3-style visual layouts for the knowledge
graph. v1 is tables grouped by domain on `/knowledge`.

Why:
The browse view's job in v1 is "find a node and open it." Tables
grouped by domain do that with zero new infrastructure. Graph
visualizations are a different product question (do users navigate by
shape?) that needs an answer informed by real usage of the table view.

Trigger to revisit:
User feedback that the table browse is insufficient for a real
authoring or learning task (e.g., "I can't see the prereq web for this
node"), OR node count crosses the threshold where table grouping
collapses into noise.

Implementation pattern when triggered:
A `/knowledge/graph` route as a separate experiment. Existing
`knowledge_edge` rows already carry the topology; render layer is
additive.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note

## AI-assisted node drafting

Status: Deferred

What was deferred:
Skeleton-from-prompt: feed a topic name to an LLM, get a `node.md`
with metadata + seven phase stubs ready for human editing.

Why:
Authoring 30 nodes by hand is feasible and produces canonical examples
the AI would need to imitate. Drafting from a tool before the
canonical examples exist would mass-produce mediocre nodes.

Trigger to revisit:
Three or more nodes are fully authored (Context through Verify),
authoring throughput is the documented bottleneck, and the canonical
nodes are stable enough to serve as prompt examples.

Implementation pattern when triggered:
Add a `bun run db draft <domain> <slug> --topic "..."` mode to the
existing scaffolder (`scripts/knowledge-new.ts`) that hits an LLM with
the canonical examples as few-shot context. Output still routes through
human review + `bun run db build --dry-run`.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note

## Node versioning + drift detection

Status: Deferred

What was deferred:
Per-node revisions + a flag for "the regulation cited here was amended
since this node was authored." v1 timestamps nodes (`created_at`,
`updated_at`) and records `knowledge_build` rows, but does not version
the node body.

Why:
v1 ships 30 nodes. Drift management at 30 is "the author re-reads them
when a regulation changes." Versioning adds schema and UI surface that
solves a problem v1 doesn't have yet.

Trigger to revisit:
A shipped node points at a regulation that gets amended, and the
amendment changes the node's truth (not just citation pagination).

Implementation pattern when triggered:
Add a `knowledge_node_version` table peer of `knowledge_node` keyed on
`(node_id, version)`. Build writes a new version on `content_hash`
change instead of in-place updating. Drift detection cross-references
the node's source citations (already on `references` jsonb) against
the active reference edition (per ADR 020).

References:

- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md) -- companion edition model

## Cross-edition reference tracking

Status: Deferred

What was deferred:
Automatic remapping of node citations when PHAK / AIM / handbook
editions roll over. v1 stores citations as plain `{ source, detail }`
in the node's `references` jsonb.

Why:
Edition rollovers are infrequent, and v1 has 30 nodes. Manual update
per rollover is feasible and produces fewer hidden assumptions than
auto-remapping at this stage.

Trigger to revisit:
A handbook edition rolls over and the manual remap takes more than a
few hours, OR node count is large enough that the spreadsheet approach
breaks down.

Implementation pattern when triggered:
Tie citations to `reference.id` (from the `handbook-ingestion-and-reader`
WP's `reference` table) rather than free text. Edition transitions become
a join through `handbook_section` aliases. ADR 020 supplies the
edition / status model.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note
- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md)

## Community contribution workflow

Status: Deferred

What was deferred:
Multi-author write access, contribution review, conflict resolution,
contributor attribution. v1 is single-author (Joshua as user zero).

Why:
[License + hosting decision (2026-04-30)](../../platform/PIVOT.md):
airboss is private / hosted-only. Public contribution is out of scope
at the platform level; multi-author is gated on internal authoring
team needs, which don't exist yet.

Trigger to revisit:
A second internal author needs write access to `course/knowledge/`.
Public contribution remains rejected at the platform level unless
licensing changes.

Implementation pattern when triggered:
Standard git PR workflow against the markdown source. Per-author
attribution is a frontmatter field on `node.md`. No DB change.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note
- MEMORY.md note: License + hosting -- private / all-rights-reserved (2026-04-30)

## Courses as views (cert / priority / coverage filter)

Status: Follow-on WP

What was deferred:
The course filter schema (`cert_filter`, `priority_filter`,
`coverage_requirement`, `assessment_gates`) specced in ADR 011 as
"courses are views over the graph."

Why:
The first concrete consumer is the FIRC course content, which lives
behind the FIRC migration phase per the multi-product architecture
(`apps/firc/` ships after study MVP is proven). Without an actual
course to express, the schema is speculative.

Trigger to revisit:
When FIRC migration begins (`apps/firc/` is being scaffolded) OR a
second course concept is concrete enough to need filtering on the
graph.

Implementation pattern when triggered:
Author a new WP for `courses-as-views`. Schema sits next to
`knowledge_node`. Filter functions extend the existing `listNodes`
chain on `libs/bc/study/src/knowledge.ts`.

References:

- [ADR 011 decision](../../decisions/011-knowledge-graph-learning-system/decision.md) -- courses-as-views section
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- FIRC migration phase

## Session engine / study plan wiring

Status: Follow-on WP

What was deferred:
The picking algorithm that selects which cards / reps a session
surfaces, based on node prereqs, mastery, and study plan focus.

Why:
Knowledge Graph v1 exposes the read functions a session engine needs
(`getNodeMastery`, `getPrerequisiteChain`, `getNodesByDomain`) but
deliberately stops short of picking. Session engine is its own design
problem with its own user surface.

Trigger to revisit:
Already in flight: the `study-plan-and-session-engine` WP is the
follow-on.

Implementation pattern when triggered:
See `docs/work-packages/study-plan-and-session-engine/`. Consumes the
knowledge BC read surface; does not need to extend the graph schema.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` -- original deferral note
- [docs/work-packages/study-plan-and-session-engine/](../study-plan-and-session-engine/) -- follow-on WP

## FIRC content migration onto nodes

Status: Follow-on WP

What was deferred:
Mapping the existing FIRC question bank, scenarios, and L01-L05
research material onto `knowledge_node` rows + edges.

Why:
FIRC moves into airboss as `apps/firc/` per multi-product architecture
after study MVP is proven. Migration of the question bank to nodes is
part of that migration, not part of building the graph.

Trigger to revisit:
FIRC migration phase begins.

Implementation pattern when triggered:
Per-topic walk through `course/firc/L02-Knowledge/` mapping each unit
to a node. The bulk of FIRC research is already aligned with the node
shape (Context / Problem / Discover / ...); transformation is mostly
mechanical.

References:

- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- FIRC migration phase
- [course/firc/README.md](../../../course/firc/README.md) -- dormant FIRC corpus

## Edge-table indexes + diff strategy (500+ nodes)

Status: Deferred

What was deferred:
Incremental edge diffing (instead of full per-touched-node edge
replace), and additional indexes on `knowledge_edge.from_node_id` and
`knowledge_edge.to_node_id` beyond what v1 ships.

Why:
At 30-500 nodes the edge table is a few thousand rows; full replace
on touched nodes is sub-second. The cost of incremental diffing
exceeds the savings until volume crosses several thousand edges.

Trigger to revisit:
`bun run db build` runtime crosses ~5s on a typical author cycle, OR
node count exceeds ~500 and the edge replace dominates the build cost.

Implementation pattern when triggered:
Diff edges per-node by hashing the parsed edge list against the
existing edges; insert / delete only the difference. Add a partial
index keyed on `(from_node_id, edge_type)` if the prereq query
explainer shows full scan.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` "Scale concerns" -- documented for awareness

## `getPrerequisiteChain` cache layer

Status: Deferred

What was deferred:
Caching transitive prereq chains. v1 runs a recursive CTE on each call
capped at `KNOWLEDGE_MAX_PREREQ_DEPTH` (5).

Why:
At 30-500 nodes, a depth-5 recursive CTE runs in single-digit
milliseconds. A cache layer at this volume is solving an imagined
problem.

Trigger to revisit:
`getPrerequisiteChain` p95 exceeds 50ms in production usage, OR depth
cap is regularly hit (indicating long chains).

Implementation pattern when triggered:
Materialized view on `(node_id, ancestor_id, depth)` refreshed on
build. Or per-request memoization inside the session-engine caller.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` "Scale concerns" -- documented for awareness

## Parallel markdown parsing

Status: Deferred

What was deferred:
Parallel execution of the per-file frontmatter + body parse step in
`bun run db build`. v1 parses files serially.

Why:
At 30 nodes the serial parse is bounded by IO and well under a second.
Parallelization adds complexity (error aggregation, worker pool) that
doesn't pay back at v1 volume.

Trigger to revisit:
Total parse time exceeds ~5s, OR node count crosses ~1000.

Implementation pattern when triggered:
Bun's `Promise.all` over a worker pool. Validation can stay in the
main thread aggregating results.

References:

- [spec.md](./spec.md) `Out of Scope (v1)` "Scale concerns" -- documented for awareness

## v2 schema columns

Status: Deferred

What was deferred:
The columns and tables the original spec described but the shipped v1
on main does without:

- `knowledge_node.slug` split (v1 uses `id` as both ULID and slug)
- `content_path` column on `knowledge_node`
- Persisted `lifecycle` column on `knowledge_node` (v1 derives on read)
- `content_hash` + `source_build_id` columns + `knowledge_build` audit table
- `knowledge_content_phase` table (v1 packs phases into `content_md`)
- `card.content_phase` column
- `scenario.node_id` + `scenario.content_phase` columns

Why:
The "v1 scope reconciliation (2026-04-20)" table in `spec.md` declares
these deferred. Each has the same shape of reasoning: the v1-on-main
simplification has not blocked a concrete authoring or learning use
case, and adding the columns now would force a schema change without a
consumer.

Trigger to revisit (per row in the reconciliation table):

- `slug` split: when a non-slug rename use case appears
- `content_path`: when multi-author workflows need an authoring-file pointer
- Persisted `lifecycle`: when query cost matters
- `content_hash` + audit table: when authoring-at-scale needs a "who / when / what build" audit trail
- `knowledge_content_phase` table: when per-phase queries (coverage reports, dashboards) outgrow render-time H2 parsing
- `card.content_phase`: when UI grouping by phase delivers authoring or learning signal
- `scenario.node_id` + `content_phase`: when scenarios need to aggregate into node mastery via the `repGate`

Implementation pattern when triggered:
Edit `libs/bc/study/src/schema.ts`; regenerate `drizzle/0000_initial.sql`
per the greenfield model (no migrations). Reseed. The reconciliation
table in `spec.md` lists the exact target shape for each row.

References:

- [spec.md](./spec.md) "v1 scope reconciliation (2026-04-20)" -- the canonical deferral table
- PR #6 -- shipped v1 schema
