---
title: 'Test Plan: Knowledge Graph'
product: study
feature: knowledge-graph
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Knowledge Graph

## Setup

- Study app running at `localhost:9600`
- Logged in as test user
- Spaced Memory Items and Decision Reps complete; their tables exist with real data (a few personal cards and scenarios from prior sessions)
- PostgreSQL running with `study` schema
- `course/knowledge/` directory exists but empty of nodes
- `bun run check` passes on main

---

## Build script

### KG-1: `bun run knowledge:new` scaffolds a node

1. Run `bun run knowledge:new airspace vfr-weather-minimums`.
2. **Expected:** File `course/knowledge/airspace/vfr-weather-minimums/node.md` created. Frontmatter has every field present (empty / `[]` / TODO-commented). Seven H2 sections stubbed (`## Context` through `## Verify`).
3. Run the same command again.
4. **Expected:** Refuses with "file already exists" error; does not overwrite.

### KG-2: `bun run knowledge:new` rejects unknown domain

1. Run `bun run knowledge:new mystery-domain some-node`.
2. **Expected:** Error "unknown domain"; no file created.

### KG-3: `bun run build-knowledge --dry-run` on a single scaffolded node

1. Scaffold one node (KG-1). Leave frontmatter mostly empty.
2. Run `bun run build-knowledge --dry-run`.
3. **Expected:** Validation errors listed (missing title, empty relevance, etc.). Exit code non-zero. No DB writes.

### KG-4: Valid frontmatter produces a clean dry-run

1. Fill in one node's frontmatter with valid values (title, domain, one relevance entry, empty edges).
2. Run `bun run build-knowledge --dry-run`.
3. **Expected:** 0 errors. Summary prints node count 1, lifecycle `skeleton`. No DB writes.

### KG-5: Broken edge reference is caught

1. Create two nodes: A and B. A's frontmatter has `requires: [nonexistent-node]`.
2. Run `bun run build-knowledge --dry-run`.
3. **Expected:** Error: "node 'A' references unknown slug 'nonexistent-node'." Build fails.

### KG-6: Cycle in `requires` is caught

1. Create two nodes A and B. A's frontmatter has `requires: [B]`; B's frontmatter has `requires: [A]`.
2. Run `bun run build-knowledge --dry-run`.
3. **Expected:** `KnowledgeCycleError` listing the cycle. Build fails.

### KG-7: Duplicate phase heading is caught

1. In a node's `node.md`, include `## Context` twice.
2. Run `bun run build-knowledge --dry-run`.
3. **Expected:** Error: "duplicate phase heading 'Context' in <path>". Build fails.

### KG-8: Successful build writes DB

1. Author all 30 skeleton nodes (valid frontmatter, no body).
2. Run `bun run build-knowledge`.
3. **Expected:** Exit 0. Summary: 30 nodes, N edges (count matches authored edges). All 30 nodes appear in `study.knowledge_node` with `lifecycle='skeleton'`. `course/knowledge/graph-index.md` regenerated.

### KG-9: Idempotent rebuild

1. Run `bun run build-knowledge` twice in a row without changing files.
2. **Expected:** Second run reports 0 node writes (all hashes match). `updated_at` on node rows does not advance. A fresh `knowledge_build` row is still recorded.

### KG-10: Edit one node then rebuild

1. Edit `airspace-vfr-weather-minimums` -- add a paragraph to `## Context`.
2. Run `bun run build-knowledge`.
3. **Expected:** Only that node's `content_hash` changes; that node's phases are upserted; its `updated_at` advances. Other 29 unchanged. Lifecycle for that node transitions skeleton -> started.

### KG-11: Pre-commit hook blocks invalid graph

1. Break one node's frontmatter (invalid domain).
2. Attempt `git commit`.
3. **Expected:** Commit blocked; `bun run check` / `bun run build-knowledge --dry-run` prints the validation error.

---

## Schema + BC

### KG-12: `study.knowledge_node` row shape

1. After KG-8, inspect any node row via `psql` or drizzle studio.
2. **Expected:** All fields populated. `id` has `kn_` prefix. `slug` matches the authored YAML id. `lifecycle='skeleton'`. `source_build_id` points to a `knowledge_build` row.

### KG-13: Edges stored directionally

1. Author node A with `requires: [B]` and node B with `applied_by: [C]`.
2. Build.
3. Query `study.knowledge_edge`.
4. **Expected:** Row `(A, B, requires)`. Row `(C, B, applies)` (note: `applied_by` reversed on write).

### KG-14: Related edges stored bidirectionally

1. Author node A with `related: [B]` but no mention on B.
2. Build.
3. Query `study.knowledge_edge` for type `related`.
4. **Expected:** Both `(A, B, related)` and `(B, A, related)` rows present.

### KG-15: Deep-built node has all seven phase rows

1. Pick a deep-built node (e.g., `airspace-vfr-weather-minimums`).
2. Query `SELECT phase FROM study.knowledge_content_phase WHERE node_id = '<that node>' ORDER BY phase;`.
3. **Expected:** Seven rows, one per phase. Each has a non-null `body` or non-empty `payload`. Node `lifecycle='complete'`.

### KG-16: Skeleton node has zero phase rows

1. Pick a skeleton-only node.
2. Query phases.
3. **Expected:** Zero rows. Lifecycle `skeleton`.

### KG-17: `getPrerequisiteChain` returns transitive closure

1. Given the authored graph, pick a node C where C requires B and B requires A.
2. Call `getPrerequisiteChain(db, C.id)`.
3. **Expected:** Returns B then A (or both, deduped). Depth stops at cap.

### KG-18: `getCoverageReport` matches file state

1. Call `getCoverageReport(db)`.
2. **Expected:** Total 30 nodes, 3 complete, 27 skeleton. Per-domain counts match what was authored. Phase gap list surfaces the 27 skeletons.

---

## Card / scenario node linkage

### KG-19: Create a personal card without a node

1. Navigate to `/memory/new`. Do not pick a node. Fill in front/back/domain/type.
2. Save.
3. **Expected:** Card saved with `node_id = NULL`, `content_phase = NULL`. Listed on `/memory/browse` as before.

### KG-20: Attach a new card to a node

1. Navigate to `/memory/new`. In the node autocomplete, pick `airspace-vfr-weather-minimums`. Pick content phase `practice`. Fill in front/back.
2. Save.
3. **Expected:** Card saved with `node_id` set and `content_phase='practice'`. Visible on `/memory/browse`.

### KG-21: Validation rejects node without phase

1. Try to save a card with `node_id` set but no content phase.
2. **Expected:** Validation error; card not saved.

### KG-22: Attach a new rep scenario to a node

1. Navigate to `/reps/new`. Pick node `proc-engine-failure-after-takeoff`, phase `verify`.
2. Fill in options + teaching point. Save.
3. **Expected:** Scenario saved with `node_id` and `content_phase='verify'`.

### KG-23: Mastery aggregates by node

1. Review a few cards attached to `airspace-vfr-weather-minimums` (mix of Again / Good / Easy ratings to build FSRS stability).
2. Call `getCardMastery(db, userId, { nodeId })` via a test route or direct BC call.
3. **Expected:** Returns totals, due count, mastered count (stability > 30 days), accuracy -- restricted to the three or more cards attached to that node.

### KG-24: Rep accuracy aggregates by node

1. Attempt the scenarios attached to `proc-engine-failure-after-takeoff` several times.
2. Call `getRepAccuracy(db, userId, { nodeId })`.
3. **Expected:** Accuracy reflects only those scenarios.

### KG-25: Deleting a node detaches but preserves cards

1. Remove a node's `node.md` and rebuild (v1 allows deletion -- node is gone from graph).
2. Check a card previously attached to that node.
3. **Expected:** Card survives with `node_id = NULL` (FK is ON DELETE SET NULL). Card remains reviewable. (Note: v1 does not expose a UI for deleting nodes; this exercises the schema safety net.)

---

## UI

### KG-26: Browse page shows all 30 nodes grouped by domain

1. Navigate to `/knowledge`.
2. **Expected:** All 30 nodes listed, grouped by domain (Airspace, Weather, Navigation, Aerodynamics, Regulations, Teaching, Flight Planning). Each node shows title + lifecycle badge (skeleton / started / complete).

### KG-27: Filter by cert

1. On `/knowledge`, select cert = PPL.
2. **Expected:** Only nodes with a PPL relevance entry appear.

### KG-28: Filter by priority

1. Select priority = core.
2. **Expected:** Only nodes with at least one `priority='core'` relevance entry appear.

### KG-29: Filter by lifecycle

1. Select lifecycle = complete.
2. **Expected:** Only the 3 deep-built nodes appear.

### KG-30: Open a deep-built node detail page

1. Click `airspace-vfr-weather-minimums` from `/knowledge`.
2. **Expected:** URL is `/knowledge/airspace-vfr-weather-minimums`. Page renders with:
   - Header with title, domain tag (`Airspace`), cross-domain tags (`Regulations`, `Weather`).
   - Mastery bar (may be 0% for a fresh user).
   - Cert relevance table (PPL core, IR supporting, CFI core).
   - Prerequisites list (populated per frontmatter).
   - Applies-in list (per `applied_by`).
   - Taught-by list.
   - Seven content phase indicators: all seven marked "available" for this node.
   - References: PHAK Ch. 15, 14 CFR 91.155.
   - Primary CTA "Start learning this node", secondary "Just review cards".

### KG-31: Skeleton node detail page shows gaps honestly

1. Open a skeleton-only node's detail page.
2. **Expected:** All seven phase indicators marked "gap -- not yet authored." The primary CTA is disabled or re-labeled ("Content coming soon") since there's nothing to learn. Metadata (relevance, references, edges) still renders.

### KG-32: Guided learning flow -- deep node

1. From the deep-built node's detail page, click "Start learning this node".
2. **Expected:** `/knowledge/<slug>/learn` loads on Phase 1 of 7 (Context). Progress bar shows 1/7.
3. Click "Continue -> Problem". **Expected:** Advances to Phase 2.
4. Continue through all seven phases.
5. **Expected:** Each phase renders the authored markdown. Discover phase embeds the referenced interactive component (for `perf-crosswind-component`, the wind triangle widget renders). Practice phase lists the attached cards and reps (titles or ids). Final phase offers "Back to node" and "Review practice cards now" CTAs.

### KG-33: Guided learning -- skip to phase

1. On the learning page, use a phase shortcut (nav menu, keyboard, or back button equivalent) to jump from Phase 1 to Phase 4 (Reveal).
2. **Expected:** Jump works; no Phase 2/3 required.

### KG-34: Guided learning -- unauthored phases

1. Open a "started"-lifecycle node (has some phases, not all) in learn mode.
2. Navigate to an unauthored phase.
3. **Expected:** "Not yet authored" placeholder renders; phase is still navigable away from.

### KG-35: Node detail page -- mastery updates after review

1. With the deep-built node's cards attached, review several of them to "Good" in `/memory/review`.
2. Return to the node detail page.
3. **Expected:** Mastery bar reflects updated state (higher %). Cert-level readiness indicators update (e.g., "PPL Remember" moves toward full).

### KG-36: Navigation item

1. From any page, the "Knowledge" nav item in the study app layout is visible.
2. Click it.
3. **Expected:** Routes to `/knowledge`.

### KG-37: Unknown slug 404

1. Visit `/knowledge/nonexistent-slug`.
2. **Expected:** 404 page.

---

## Integration

### KG-38: Full-cycle authoring round trip

1. Scaffold a new node via `knowledge:new`.
2. Fill in frontmatter + some phase prose.
3. Create a card via `/memory/new`, attach to the new node.
4. Run `bun run build-knowledge`.
5. Open `/knowledge/<new-slug>`.
6. **Expected:** Node appears with correct metadata, the attached card counts toward mastery.

### KG-39: Build script survives a rebuild after data already attached

1. Given a node with attached cards (some reviewed).
2. Edit the node's frontmatter (change `title`) and rebuild.
3. **Expected:** Title updates in the DB. `node_id` on cards still matches (`id` is unchanged). Review history and mastery preserved.

### KG-40: Graph index markdown matches DB

1. After a build, open `course/knowledge/graph-index.md`.
2. **Expected:** Matches `getCoverageReport` output. Lists all 30 nodes grouped by domain with lifecycle badges and phase gap counts. Committed to git.

### KG-41: Existing tool flows unaffected

1. Review cards (`/memory/review`) not attached to any node.
2. Run a rep session (`/reps/session`) on unattached scenarios.
3. **Expected:** Flows behave exactly as before. `node_id` column being present but NULL doesn't change any behavior.
