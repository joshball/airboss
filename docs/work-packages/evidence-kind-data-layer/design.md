---
title: 'Design: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: design
status: unread
review_status: pending
---

# Design: Evidence Kind Data Layer

Rationale, alternatives considered, and key decisions for the substrate that closes WP B's three `not_applicable` shims.

Anchors: [spec](./spec.md), [tasks](./tasks.md), [WP B design](../evidence-kind-gating/design.md), [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md).

## Why a separate WP

WP B (`evidence-kind-gating`) shipped in PR #361 with three deliberate `not_applicable` shims. The reason WP B couldn't close them inline was simple: closing them required schema work (a `card.kind` column, a `scenario.assessment_methods` column, an expanded `SESSION_ITEM_KINDS` enum + a teaching-exercise table to attach the new item kind to) plus authoring tooling on those columns. WP B's scope was the gate logic. Bundling the data substrate in would have ballooned the PR past comfortable review.

The split is clean: WP B introduced the per-kind contract (gate function, leaf aggregation, cert-aware triad mapping). WP D (this WP) fills the contract with real partitions. After WP D, the documented "data does not exist yet" notes in `mastery.ts:1-38` go away.

## Three data gaps in concrete terms

### Gap 1 -- card.kind

Today `card.cardType` describes presentation form: `basic | cloze | regulation | memory_item`. That's a useful axis for the renderer (a regulation card shows the cite chip; a cloze card shows the masked-deletion field). It is *not* the axis the per-kind mastery gate cares about.

The mastery gate cares whether the card tests *recall* ("what's the meaning of an Airworthiness Directive?") or *calculation* ("at 60 NM and 4500 MSL, what's the cone of confusion height?"). Same regulation can be authored as a recall card or a calculation card depending on which side of the AC the pilot is on.

Two-axis modeling solves it: `card.cardType` keeps its renderer role, `card.kind` adds the knowledge-axis role. Every existing card defaults to `kind='recall'` because recall is the dominant case and the migration is metadata-only that way. Future authoring distinguishes calculation cards via the `kind: calculation` yaml-cards key.

### Gap 2 -- scenario.assessment_methods

Today `scenario` has no method tag. Every rep on every scenario contributes to the "scenario evidence" gate. That collapses two distinct cases:

- **Judgment scenarios.** "ATIS reports 270 at 18, gusting 25; you're cleared to land Runway 36. Pick: (a) request a different runway, (b) accept and brief crosswind, (c) divert." This is judgment evidence: did the pilot pick the right action under uncertainty.
- **Maneuver-demonstration scenarios.** "You are flying a steep turn at 60 degrees of bank. Maintain altitude within +/- 100 ft; complete a 360-degree turn within +/- 10 degrees of entry heading." This is demonstration evidence: did the pilot perform the maneuver to standard.

Per ADR 016 + Learning Philosophy principle 9, the two are different evidence kinds. An R leaf demands judgment scenarios; an S leaf accepts either, with demonstration being the ideal. Without a column on `scenario`, the BC can't tell which a given scenario is.

The column lands as `jsonb` because some scenarios genuinely cover both -- a checkride-style hybrid where the pilot picks an option AND demonstrates the chosen maneuver. That row should contribute to both gates, not be pinned to one. JSONB keeps the array shape consistent with `knowledge_node.assessment_methods` (already shipped) so downstream tooling treats both consistently.

### Gap 3 -- teaching-exercise session item kind

Today `SESSION_ITEM_KINDS = { card, rep, node_start }`. There is no value for "the candidate did a teaching activity." A CFI candidate's evidence stream includes (eventually):

- Recall cards (read regulation, recall facts).
- Decision reps (judge a scenario as a CFI would).
- Teaching exercises (explain a concept to a fictional or real student; demonstrate a maneuver while narrating the why).

Teaching exercises are different enough from cards and reps that they deserve their own item kind. The grading shape is similar to a rep (correct / incorrect with feedback) but the underlying entity is a free-response prompt, not a multiple-choice scenario. Reusing the `scenario` table would force NULL options and break the scenario invariant ("exactly one correct option").

Three coupled changes make the gap real:

1. The `SESSION_ITEM_KINDS` enum gains `TEACHING_EXERCISE = 'teaching-exercise'`.
2. A new `teaching_exercise` table (mirroring `scenario`'s shape: id, user, title, prompt, node_id, ...) holds the authored prompts.
3. `session_item_result` gains a nullable `teaching_exercise_id` FK so a row with `item_kind='teaching-exercise'` resolves to its prompt.

The teaching gate query then groups `session_item_result` rows by `teaching_exercise.node_id` and runs `computeRepGate` over them.

## Why this WP, not the CFI ACS-25 transcription WP, owns the substrate

The CFI ACS-25 transcription WP (a future content WP) does *content* work: it authors `requires_teaching=true` flags on the right CFI ACS-25 leaves, and it authors actual teaching-exercise rows for each of those leaves. That WP can't start until the substrate is here -- there's nowhere to set the FK to until the table exists.

Splitting substrate from content lets each WP move at its own pace:

- **This WP (data layer).** Schema + BC + authoring tooling. Lands once. Defaults are safe (every card → recall, every scenario → scenario, no teaching-exercise rows). System behavior is identical to WP B today, except the BC now has the partitioned shape ready.
- **Future WP (CFI content).** Walks the FAA CFI ACS-25 PDF, authors `requires_teaching=true` flags + teaching-exercise rows. Pure content; no schema. Many sessions of authoring.

The split also matches the principle "do the right thing, always": shipping the schema with empty data is fine; shipping the schema *and* hand-authoring 200+ teaching exercises in one PR is not.

## Key decisions

### D1 -- `card.kind` is a separate enum, not a reuse of `ASSESSMENT_METHODS`

Cards are recall or calculation; never scenarios, demos, or teaching. A separate `CARD_KINDS` constant captures that closure. The values still match the `ASSESSMENT_METHODS` strings exactly (`'recall'`, `'calculation'`), so the partition query in `mastery.ts` is a simple string compare across both.

Alternative considered: reuse `ASSESSMENT_METHODS` directly as the column type. Rejected because the schema CHECK can't enforce a subset of the enum without duplicating values, and authoring tooling has to filter the dropdown anyway.

### D2 -- `scenario.assessment_methods` is jsonb array, not text scalar

Hybrid scenarios are real (the steep-turn-judgment-then-execute case). A scalar would force fan-out into separate scenario rows for the dual-purpose case, which the user has to clean up later when content evolves. JSONB keeps it as a single row with a small array. Storage is trivial; query is `LATERAL UNNEST` (or `jsonb_array_elements_text`) which Postgres handles cleanly.

Alternative considered: scalar `assessment_method text`. Rejected -- dual-purpose case is real and forces author duplication.

### D3 -- New `teaching_exercise` table, not scenario reuse

A teaching exercise is a free-response prompt with optional grading metadata (rubric, exemplar). A scenario is a multiple-choice decision with options + correct answer + per-option whyNot rationales. The data shapes are genuinely different.

Reusing `scenario` would require:

- NULL `scenario_option` rows on teaching scenarios -- breaks the `scenario_option_correct_unique` invariant.
- A discriminator field on `scenario` (`is_teaching: boolean`) that has to be checked everywhere a scenario is read.
- Authoring tooling that branches on the discriminator to render different forms.

A separate table keeps each domain clean. The cost is one more table; the benefit is each table's invariants stay enforceable at the schema layer.

### D4 -- One session-item-kind for teaching, not split by modality

`teaching-exercise` covers both "explain this concept to a student" and "demonstrate this maneuver while narrating the why." Splitting into `teaching-explanation` + `teaching-demonstration` fragments the rollup without product gain -- the teaching gate would aggregate them anyway. Modality lives on the exercise's own metadata (a follow-on content WP defines the prompt schema; for v1 a single `prompt: text` column is enough).

Alternative considered: split. Rejected -- doubles the enum for no rollup benefit.

### D5 -- Migration backfills via column defaults, no data motion

PostgreSQL >= 11 makes `ALTER TABLE ADD COLUMN ... DEFAULT 'value'` a metadata operation -- the default is materialized lazily on read, not by rewriting the table. So the migration is fast even on a large `card` table.

The implication is every existing row picks up the default value (`kind='recall'`, `assessment_methods=['scenario']`). For most rows that's correct (recall is the dominant card kind; judgment is the dominant scenario method). For mis-categorized rows the audit script (Open Question (d)) surfaces the distribution so the content team can flip the wrong ones over time.

The alternative is a per-row classifier (e.g. an LLM that reads the card front and decides recall vs calculation). Rejected for v1 -- the default is good enough, the audit script is the safety net, and the cost of wrong defaults is bounded (a leaf reads as recall-mastered when it isn't, which the WP B gate already catches via the K vs S triad mapping).

### D6 -- Mastery wire-up extends `mastery.ts`, no new file

The shims documented in the existing `mastery.ts` file header become real partition queries in the same function (`getNodeEvidenceStateMap`). The function grows but stays single-purpose. A new `evidence-partitions.ts` would split "compute the partition" from "apply the gate" but that's a one-consumer abstraction -- premature.

Alternative considered: new file. Rejected -- second consumer may never appear; the indirection costs more than it gains.

### D7 -- Authoring sanity-check ships as part of this WP

Open Question (d). The script is small (two SELECT GROUP BY queries), informational only, and exists specifically because the migration default-applies values that may be wrong. Shipping the visibility tool with the migration that creates the visibility need keeps the punch list visible from day one.

Alternative considered: defer to the content WP. Rejected -- punts visibility for no real cost saving.

## Alternatives considered (rejected)

### A1 -- Add `card.kind` as an extension of `card.cardType`

"Just add `'recall'` and `'calculation'` to `CARD_TYPES`." Rejected because `cardType` is a presentation axis (basic vs cloze etc.) and conflating the two confuses authoring. A regulation card can be recall or calculation; both axes need to coexist.

### A2 -- Per-card OR per-scenario assessment method on `knowledge_node` instead

`knowledge_node.assessment_methods` already exists. The temptation is to read it for every gate computation: "for node N, is method M valid?"

This conflates two concepts:

- **Node validity:** "Is method M a sensible way to evaluate this node?" Yes for "steep turn" + demonstration; no for "definition of an AD" + demonstration.
- **Evidence presence:** "Does the user have *any* M-tagged evidence on this node?" Independent of validity -- a learner could have demonstration evidence on a node that doesn't really demand it.

The mastery gate cares about evidence presence, partitioned by which item declares which method. Method on the node is content metadata; method on the card / scenario / teaching-exercise is authoring intent. They're different.

### A3 -- Materialize per-kind counts in a denormalized table

A `study.node_kind_counts` table caching `(user_id, node_id, kind, total, mastered)` would make `getNodeEvidenceStateMap` a single SELECT. Rejected for v1:

- Denorm requires triggers / sync logic to stay current.
- The current query is bounded by the user's card + scenario count for the credential's node set -- already small.
- Profiling first; denorm only if a hot path emerges.

### A4 -- Use a CFI-specific schema for teaching evidence

Teaching evidence is CFI-flavored, but it's not exclusively CFI -- a non-CFI candidate explaining a regulation to a study buddy is using the same evidence shape. Pinning the table to CFI bakes in an assumption that may not hold. The table is generic; the *content* (which leaves require teaching) is CFI-flavored, captured via `requires_teaching` on the leaf, not on the table.

### A5 -- Hard-fail rather than `not_applicable` for missing partition data

Today, a kind with zero matching evidence on a node returns `not_applicable`. An alternative is to return `fail` so a leaf reads as unmastered the moment any required kind is missing.

WP B explicitly chose `not_applicable`. The rationale stays valid: `not_applicable` distinguishes "the user has no evidence of this kind, but the kind is required" from "the user has tried and failed at this kind." `missingKinds` carries the "required but not passing" signal; `byEvidenceKind` carries the gate states. The boolean (`mastered`) reflects the user-facing outcome ("the leaf is not mastered").

This WP keeps that semantic. Per-kind partitioning makes `not_applicable` more meaningful (a node with zero calc cards is a real signal), not less.

## Schema migration shape

See `spec.md` item 9 for the SQL. The migration is `0003_evidence_kind_data_layer.sql`, single file, no consolidation. PostgreSQL handles the ALTER TABLE ADD COLUMN ... DEFAULT as metadata-only (no rewrite). The CREATE TABLE for `teaching_exercise` is independent.

## Test design

`mastery.test.ts` (already exists for WP B) is extended -- not replaced. Existing cases continue to pass; new cases exercise:

1. **Cards partition.** Recall vs calculation on the same node, separately and together.
2. **Scenario partition.** Methods filter via the new column; hybrid scenario contributes to both gates.
3. **Teaching gate.** Inserted teaching_exercise + session_item_result rows feed the gate.

New BC unit tests cover the validators (`createCard` rejects invalid kinds, `createScenario` rejects empty / duplicate methods, etc.). Integration tests cover the migration shape (column existence, CHECK constraints, FK behavior).

The audit scripts are regression-tested by feeding them a controlled seed and verifying the count output.

## Open follow-ups (do not start in this WP)

- **CFI ACS-25 content authoring** -- separate WP, takes the table shape this WP defines.
- **Engine pickup of teaching-exercises** -- session selection logic to choose teaching-exercises when a CFI leaf is missing teaching evidence. Separate WP.
- **Per-kind threshold tuning** -- whether scenario reps want a different `REP_MIN` than judgment reps. Tracked; defer until data shows a need.
- **GIN index on scenario.assessment_methods** -- only if profiling shows the LATERAL UNNEST query is slow.
- **Multi-modal teaching exercises** -- prompt schema beyond `text` (oral exam transcripts, video, etc.). Out of scope; v1 is text prompt + correct/incorrect grading.
