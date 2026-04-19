---
title: 'Design: Knowledge Graph'
product: study
feature: knowledge-graph
type: design
status: unread
review_status: pending
---

# Design: Knowledge Graph

Rationale behind the choices in [spec.md](./spec.md). Alternatives are described briefly where a decision was close.

## Scope anchor: 30 nodes, not 500

ADR 011 calls 500 nodes the long-term target and 30 nodes "an experiment to test the model." This feature implements the 30-node version. Every decision below is weighed against "does this still work at 500?" but no decision is paid for up front. Three concrete examples:

- The `knowledge_edge` table is fully normalized (not an adjacency-list JSONB column) because at 500 nodes, JSONB edge queries would hurt. At 30 they'd be fine. Paying now avoids a migration later.
- The build script uses "replace all edges for touched nodes" rather than diffing edge sets -- trivial at 500 nodes, worth revisiting at 5000. Spec documents the scale limit, design accepts the simplicity.
- `getPrerequisiteChain` is capped at depth 5 via `KNOWLEDGE_MAX_PREREQ_DEPTH`. At 30 nodes a transitive chain is short; the cap is a defensive ceiling for later.

## Schema rationale

### Why four new tables

**`knowledge_node`** is the obvious parent. Fields map directly to ADR 011's node metadata. The non-obvious column is `slug` alongside the ULID `id`:

- The ULID is stable across renames. It's what `study.card.node_id` points at so a card doesn't orphan when a node's slug is corrected.
- The slug is the authoring-facing identifier -- it appears in frontmatter, in other nodes' `requires` lists, and in URLs. Stable enough in practice but renameable.
- Having both means renaming a node is a frontmatter edit + rebuild, not a data migration.

`content_hash` enables "no-op rebuild" behavior, which matters once authors iterate daily. `source_build_id` and the `knowledge_build` audit row are the underappreciated half of that: they let Joshua ask "what did the graph look like on 2026-05-12?" by scanning builds, not by scanning git history for the markdown.

**`knowledge_edge`** is normalized because edges are the primary query surface -- "nodes requiring X", "things that apply Y", "prerequisite chain for Z". A JSONB edges column on the node row would need a full table scan for any "who points at this node?" question.

Normalizing all edges directionally (`from_node_id` -> `to_node_id`) and storing the `edge_type` as a column (not separate tables per type) trades two indexes for unified SQL. `SELECT * FROM knowledge_edge WHERE to_node_id = ? AND edge_type = 'requires'` is one query that answers both "what does this depend on" (flip the column) and "what depends on this" (keep the column).

**`knowledge_content_phase`** is a child table not an inline JSONB blob, because phases are authored and queried independently. The node detail page pulls seven phases with a `WHERE node_id = ?` scan (seven rows max). Absence of a row means "unauthored"; we don't need a NULL body column to express that, but we keep one so a phase can have just structured `payload` (e.g., Practice lists cards + reps but has no prose).

**`knowledge_build`** exists because validation is all-or-nothing and we want an audit trail of when content changed. Without it, failed builds would leave no trace. With it, the coverage history for the graph is visible.

### Alternatives considered

- **Adjacency list on the node row.** Rejected: `edges: jsonb` makes reverse queries O(N) and makes per-edge metadata awkward.
- **Separate tables per edge type** (`knowledge_requires`, `knowledge_deepens`, etc.). Rejected: every graph query becomes a UNION of five tables for no benefit.
- **Inline the seven phases as columns on `knowledge_node`.** Rejected: seven mostly-NULL columns per node, no way to express "phase was authored but is intentionally empty", awkward to add an eighth phase later.
- **Content in DB only, no markdown.** Rejected: violates CLAUDE.md "markdown-first, DB-built", and makes the graph ungreppable / unreviewable in PRs.
- **Markdown only, no DB.** Rejected: the study app (and later the session engine) needs sub-millisecond queries for "what nodes are in domain X, mastered state Y, with node_id linked cards." Parsing 500 markdown files on each page load is a nonstarter.
- **SQLite instead of Postgres.** Rejected: study BC is already on Postgres via `@ab/db`. No reason to split.

## Edge model rationale

The five edge types map to distinct query patterns:

| Edge type   | Primary consumer                                               | Directionality                                |
| ----------- | -------------------------------------------------------------- | --------------------------------------------- |
| `requires`  | Session engine "prerequisites-met" filter; node detail "prerequisites" block | Must be a DAG; load-bearing                   |
| `deepens`   | "When you're ready to go further" on node detail; study-plan depth preference | Typically points from shallower to deeper; same domain |
| `applies`   | Cross-domain "where is this used?"; `applied_by` list on node detail | From consumer to source (normalized reversed) |
| `teaches`   | Pedagogical axis -- CFI-level nodes pointing to the technical nodes they teach | From pedagogy node to technical node          |
| `related`   | Weakest edge; cross-references                                  | Bidirectional                                 |

Keeping `related` weak and separate lets the session engine legitimately ignore it. Mixing it into `deepens` or `applies` would corrupt the signal those edges are supposed to carry. ADR 011's "discipline rule" -- `requires` must point to a specific node, not a broad area -- isn't enforced by schema but shows up as a code review concern on authored nodes.

**Why normalize `applied_by` and `taught_by` on write.** The frontmatter lets the author specify the edge from whichever side is more natural. "Who applies this?" reads well on the prerequisite node; "Who teaches this topic?" reads well on the technical node. Storing both directions in the same shape (`from` -> `to`) means every traversal uses the same SQL. The frontmatter-to-storage translation is a one-liner per edge type in the build script.

**Why `related` inserts both directions.** Querying "what is related to X?" should be a single `WHERE from_node_id = X OR to_node_id = X` and dedupe. Storing both rows lets it be `WHERE from_node_id = X`. The cost is a handful of duplicate logical edges in the table; at 30 nodes this is a hundred rows. Open question #7 flags this for Joshua's confirmation.

## Content storage rationale

**Chosen: hybrid. Markdown is canonical, DB is a built projection.**

Argued against two alternatives:

1. **DB-only.** Would require an authoring UI in v1 we don't have, strip the graph out of git history, and make "grep for nodes that reference 91.155" impossible. Violates PRD "markdown-first, DB-built."

2. **Markdown-only (parse on demand).** Works for the node detail page at small scale. Fails for any cross-node query: "all PPL/core nodes in weather domain with complete lifecycle" requires parsing every file. Also fails for attachment queries: `study.card.node_id` needs a referential target.

**Why hybrid is the right fit:**

- Matches the discovery-first pedagogy rule. Authors write prose in markdown, under H2 headings that name each of the seven phases. The structure is visible in git diffs and code reviews -- a reviewer can see that a node has Context and Reveal but no Discover, and call the gap out. That's the "ask the questions, leave them unanswered" discipline from ADR 011 made concrete.
- Keeps authoring friction at "write a file, run `bun run build-knowledge --dry-run`." No authoring UI needed for v1.
- DB mirrors everything the app needs to query. The app never reads the filesystem.
- Rebuildable. If the DB is wiped, `bun run build-knowledge` restores the graph exactly.

**What lives where:**

| Data                                  | Source of truth | DB              |
| ------------------------------------- | --------------- | --------------- |
| Node metadata (domain, relevance, edges) | `node.md` frontmatter | `knowledge_node` + `knowledge_edge` |
| Phase prose (Context, Problem, etc.)  | `node.md` body  | `knowledge_content_phase.body`     |
| Phase structured payload (activity ids, card ids, rep ids, calc prompts) | YAML fences inside phase sections | `knowledge_content_phase.payload` (JSONB) |
| References (PHAK chapter, CFR section) | `node.md` frontmatter | `knowledge_node.references` (JSONB) |
| Assets (diagrams, images)             | `course/knowledge/{domain}/{slug}/assets/` | Paths referenced from body; not in DB |
| Per-node card/rep attachments         | `node.md` Practice phase payload + `study.card.node_id` / `study.scenario.node_id` | DB is the primary query target (faster than scanning) |
| Interactive activities (wind triangle, etc.) | `libs/activities/{id}/`                     | Referenced by id in `payload.activities` |
| Mastery / progress                    | n/a (derived)   | Computed from `study.review`, `study.rep_attempt` |

The `node.md` structure -- H2 headings with YAML fences for structured lists inside the Discover and Practice phases -- is a deliberate compromise: readable enough for a human author, structured enough for the build script to parse deterministically.

## Integration with spaced-memory-items and decision-reps

Both feature schemas shipped before this one with `source_type` + `source_ref` + `is_editable` as the primary content-origin signal. This feature adds `node_id` + `content_phase` as an orthogonal axis:

```text
               source_type (where it came from)
              personal / course / product / imported
                             +
                         node_id
            NULL (not graph-linked) / kn_... (attached to a node)
```

A card can be `source_type='personal'` and `node_id='kn_...'` (author-linked a personal card to a graph node). Or `source_type='course'` + `node_id='kn_...'` (course published a card attached to a node). Or `source_type='personal'` + `node_id=NULL` (today's default -- a free-floating personal card).

**Mastery aggregation:** `getCardMastery` gains an optional `nodeId` filter. When the node detail page asks "how am I doing on VFR weather minimums?", it's `getCardMastery(userId, { nodeId })` -- one SQL query, uses the existing `card_user_status_idx` extended with `node_id`. Same pattern for `getRepAccuracy`.

**Why not a junction table?** Tried mentally: `study.card_node` with `(card_id, node_id, phase)`. Rejected because a card attaches to exactly one phase of at most one node in the v1 model; a column on the card row is simpler and lets a single SQL query answer mastery without a JOIN. If cards-to-many-nodes becomes a real use case (e.g., a card about "W&B arm" that slots into both `perf-weight-and-balance` and `plan-vfr-cross-country`), promote to a junction table at that point -- backward-compatible migration: keep `node_id` as the primary attachment, add the junction for secondary attachments.

**Decision Reps `scenario`:** mirror treatment. `node_id` + `content_phase` (usually `verify` for assessment scenarios, `practice` for drill reps). `getRepAccuracy` gains the node filter. No schema surprises.

## Mastery computation

**Dual gate, not weighted average.** A node is `mastered` iff its card pillar AND its rep pillar both independently clear their thresholds. A weighted score (`cards * 0.6 + reps * 0.4`) can hide a weak pillar -- 90% recall with 50% judgment reads as 0.74, but the pilot doesn't know how to apply the knowledge. Aviation culture rejects "good enough" composites: you either know stalls or you don't. The dual gate forces both pillars to mature.

**Asymmetric thresholds.** Card ratio is held to 0.80 (4-of-5 attached cards mature); rep accuracy is held to 0.70 (one miss in three tolerated). Reps are harder than cards -- they embed scenario ambiguity -- so the rep bar is set lower on purpose. Platform constants live in `libs/constants/study.ts`; authored once, lived with, promoted to per-node overrides in v2 if the defaults mismatch real use.

**Minimum-data gates.** A node needs `>= 3` attached cards (or `>= 3` rep attempts) before its pillar can resolve to `pass`. Below that, the pillar reports `insufficient_data`. This prevents "mastered after 1 correct card" artifacts.

**Asymmetric fallback for single-pillar nodes.** Nodes with no attached scenarios (pure knowledge nodes like definitions) see `repGate = not_applicable` and are judged on cards alone. The symmetric case (rep-only judgment nodes) is possible but rare in v1. Nodes with nothing attached are never mastered.

**Display score separate from gate.** Progress bars render `(cardsMasteredRatio + repAccuracy) / 2` (or the single-pillar value when only one applies). The displayed percentage can be high while `mastered == false` -- intentional. Seeing "78%, not yet mastered" communicates the gap.

**Why not bloom-indexed thresholds in v1?** ADR 011 notes higher bloom levels need stricter rules. Punted -- the constants above are a single set until scale. A bloom-indexed table can be introduced without changing the gate shape.

**Reconciliation with study-plan + dashboard.**

- Study Plan's `isNodeMastered(userId, nodeId) -> boolean` returns `getNodeMastery(...).mastered`.
- Study Plan's `getNodeMastery(...) -> { score, trend }` maps to `{ score: displayScore, trend: 14-day delta of displayScore }`.
- Dashboard's cert-progress and domain-cert-matrix aggregate the boolean `mastered` across nodes in scope.

## Seed-node authoring workflow

**Problem:** 30 nodes, most of which are skeletons, authored by one person (Joshua) over an extended period. Needs:

- Template consistency -- every node starts with the same frontmatter skeleton.
- Validation feedback while drafting, not only at commit time.
- Low ceremony -- "new node" should be one command.

**Chosen workflow:**

1. `bun run knowledge:new <domain> <slug>` scaffolds `course/knowledge/<domain>/<slug>/node.md`. The scaffold contains:
   - YAML frontmatter with every field present. Required fields are empty strings; arrays are `[]`; optional fields are commented with `# TODO:` markers. This implements ADR 011's "ask the questions, even when you can't answer them" principle.
   - H2 section stubs for all seven phases, each containing a `<!-- TODO -->` placeholder comment.
2. Author fills in whatever is known. Commits the skeleton immediately -- a skeleton is useful per ADR 011 ("session engine can see 'you haven't started Weather yet' from metadata alone").
3. Author runs `bun run build-knowledge --dry-run` whenever they want validation feedback. Fast enough to run on save.
4. Content fills in over time. Every fill is a commit.
5. On commit: `bun run check` includes `build-knowledge --dry-run`. Invalid frontmatter blocks commit.

**Why not an in-app form?** For 30 nodes, a form would take longer to build than to use. Markdown in VS Code is fine. An authoring UI lands when hangar does.

**Why not generate frontmatter from a prompt (AI-assisted drafting)?** ADR 011 lists this as beyond-MVP. For v1, it would hide the "ask the hard questions" moment -- deciding that a node is `perceptual` or `judgment`-type is part of thinking about what the node IS. Automating that first pass short-circuits the design work. Deferred.

## Alternatives considered (quick)

| Alternative                                              | Why not                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| Build on file-save (watch mode)                          | Surprise writes; breaks when multiple nodes change. Explicit `bun run build-knowledge` is saner |
| Neo4j or a dedicated graph DB                            | Adds a service, a query language, and ops. Postgres at 500 nodes is trivially fast |
| Store edges as `node.edges: jsonb`                       | See "Schema rationale"                                            |
| Store phases as seven columns on node row                | See "Schema rationale"                                            |
| Free-text phases (no 7-phase discipline)                 | Loses the discovery-first pedagogy baked into ADR 011             |
| No `slug` column; use the kebab-case id as the PK         | Renaming a node would orphan every card/scenario/edge referencing it |
| Represent `relevance` as a child table                   | Five-row-max child table for a read-mostly structured value; JSONB + validation is cleaner |
| Courses as filters in this feature                       | ADR 011 describes them but ships them with FIRC migration -- not this feature's scope |

## Activities library note

`libs/activities/` does not exist yet. The spec allows nodes to reference activity ids in Practice and Discover payloads, but v1 only lands one activity: `libs/activities/wind-triangle/`, consumed by the deep-built `perf-crosswind-component` node. This validates the `activity: <id>` payload shape and the cross-lib component import pattern. Every other interactive activity is deferred. The build warns on unknown activity ids but does not fail (they're treated as authoring TODOs).

## Observability

- `knowledge_build` rows give a query-able audit trail: `SELECT started_at, status, node_count, coverage FROM study.knowledge_build ORDER BY started_at DESC LIMIT 10;`.
- The auto-generated `course/knowledge/graph-index.md` is a per-build human-readable status page -- which nodes are skeleton/started/complete, which phases are empty, which edges orphaned. Committed to git so reviewers can see graph state in PRs.
- `getCoverageReport` BC function exposes the same data to the UI (the browse page uses it).

## Security + permissions

The graph is read-only for all authenticated users in v1. Writes happen exclusively through `bun run build-knowledge`, which runs outside request context (CLI). No route exposes a write path. This means no auth scope for "edit node" is needed in v1 -- authorship is a git operation.
