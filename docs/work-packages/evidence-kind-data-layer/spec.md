---
title: 'Spec: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: spec
status: read
review_status: pending
---

# Spec: Evidence Kind Data Layer

`evidence-kind-gating` (PR #361) shipped per-kind leaf gating with three `not_applicable` shims because the substrate the gates demand doesn't exist yet:

- `card.kind` -- there is no recall vs calculation partition on cards. The `recall` gate folds in every card; the `calculation` gate is hard-wired to `not_applicable`.
- `scenario.assessment_methods` -- there is no per-scenario method tag. Every rep contributes to the `scenario` gate; the `demonstration` gate is hard-wired to `not_applicable`.
- `SESSION_ITEM_KINDS.TEACHING_EXERCISE` -- there is no `teaching-exercise` session item kind. The `teaching` gate is hard-wired to `not_applicable`.

This WP closes those shims. After it ships, every per-kind gate computes against real authored data: recall vs calculation cards partition cleanly, scenarios declare `assessment_methods` so demonstration reps separate from judgment reps, and CFI teaching exercises emit a session-item-kind that the teaching gate aggregates per node. CFI ACS-25 transcription -- the content-side authoring of `requires_teaching=true` flags and the actual teaching-exercise content -- is a separate WP. This WP only adds the data spine and consumes it.

Learning Philosophy principle 9 ("Evidence of mastery has to match the kind of knowledge") is the contract. Principle 5 ("Progress rolls up at every level the learner thinks at") is the consumer -- once the spine is in place, every rollup the learner sees can split by kind without losing the dual-gate semantics on its way up.

## Why this WP exists

WP B's `mastery.ts` header documents the gap directly:

```text
- `recall`: aggregated from every card attached to the node. The card
  schema does not currently carry a recall vs calculation kind, so the
  `recall` gate folds in every card. When `card.kind` lands, the gate
  filters by `card.kind = 'recall'` instead.
- `scenario`: ... When `scenario.assessment_methods` lands, the gate
  filters by methods that include `'scenario'`.
- `calculation`, `demonstration`: backing partition data does not exist
  yet. Both gates report `not_applicable` until a follow-on data WP adds
  `card.kind` and `scenario.assessment_methods`.
- `teaching`: depends on a `'teaching-exercise'` `SESSION_ITEM_KINDS`
  value that does not exist yet.
```

Concretely, three failure modes exist on `main` today even after WP B:

1. **A card-only learner masters a `risk_management` leaf.** The leaf demands `[scenario]` but every card on the linked node is treated as `recall` evidence; the dual-gate cards pillar passes. WP B already fixes this: the `scenario` gate is `not_applicable` so the leaf reads as not-mastered and `missingKinds=['scenario']`. This data-layer WP does not change that behavior; it tightens the recall partition so a learner with only `calculation` cards on a K leaf doesn't drift back into `recall=pass`.
2. **A `calculation`-heavy learner on a weight-and-balance K leaf.** The K leaf in the recommended mapping accepts `[recall]`. The learner has only `calculation` cards on the linked W&B node. Today every card is treated as `recall` so the gate passes. After this WP, the cards partition by `kind`: `recall=not_applicable` (zero recall cards), `calculation=pass`. Whether that satisfies the K-leaf gate depends on the triad mapping (recommended K=`recall` only, so the learner reads as not-mastered until they add recall cards). The point is the BC now sees the difference.
3. **A CFI candidate clears a CFI K leaf without ever teaching.** Even with `requires_teaching=true` authored on the leaf, today the teaching gate is `not_applicable` because no `teaching-exercise` item kind exists. The leaf reads as mastered as soon as recall passes. After this WP, teaching-exercise session items emit `item_kind='teaching-exercise'`; the gate computes against real rows; a recall-only CFI candidate reads as not-mastered with `missingKinds=['teaching']`.

The CFI ACS-25 transcription that flips `requires_teaching=true` on the right leaves remains a separate content-authoring WP. This WP delivers the substrate so that authoring WP has somewhere to land.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md). Out of Scope item "Mastery evidence-kind gating" is now half-shipped (PR #361) and half-pending (this WP).
- [Learning Philosophy principle 9](../../platform/LEARNING_PHILOSOPHY.md). Evidence kinds must match knowledge kinds.
- [Learning Philosophy principle 5](../../platform/LEARNING_PHILOSOPHY.md). Mastery rolls up cleanly because every kind's gate uses the same threshold logic with a partition.
- [Evidence Kind Gating spec](../evidence-kind-gating/spec.md). The WP whose `not_applicable` shims this WP closes.
- [Cert, Syllabus, and Goal Composer spec](../cert-syllabus-and-goal-composer/spec.md). Cert dashboard / lens consumers will surface the richer rollup once a follow-on UI WP picks it up.
- [Engine Goal Cutover spec](../engine-goal-cutover/spec.md). Parallel WP -- both have shipped, both touched the goal model. This WP is independent.
- `libs/bc/study/src/mastery.ts:1-38` -- the file header that documents every shim this WP closes.
- `libs/bc/study/src/mastery.ts:182-298` -- `getNodeEvidenceStateMap` -- the per-kind gate computation. Shims become real partitions in this WP. The three explicit `NODE_MASTERY_GATES.NOT_APPLICABLE` shim assignments live at lines 284, 289, 293.
- `libs/bc/study/src/schema.ts:326-389` -- `card` table. Gains `kind` column.
- `libs/bc/study/src/schema.ts:541-593` -- `scenario` table. Gains `assessment_methods` jsonb column.
- `libs/bc/study/src/schema.ts:813-908` -- `sessionItemResult` table. The `sir_item_kind_check` constraint at line 907 extends to admit `teaching-exercise`.
- `libs/constants/src/study.ts:214-225` -- `CARD_TYPES` (`basic | cloze | regulation | memory_item`). Different axis -- presentation form, not knowledge kind. This WP introduces a *new* `CARD_KINDS` enum for the knowledge axis.
- `libs/constants/src/study.ts:671-681` -- `ASSESSMENT_METHODS` (`recall | calculation | scenario | demonstration | teaching`). Already exists; this WP adopts it as `card.kind`'s value space (subset) and `scenario.assessment_methods`'s value space.
- `libs/constants/src/study.ts:808-816` -- `SESSION_ITEM_KINDS` (`card | rep | node_start`). Gains `teaching-exercise`. (Note: `NODE_MODALITIES` already carries a `TEACHING_EXERCISE: 'teaching-exercise'` value at line 663 -- this is a separate axis, not the session-item-kind addition this WP makes.)
- `scripts/db/seed-cards.ts:39-44` (`ParsedCard` interface), `:72-115` (yaml-cards fence parser), `:172-188` (BC `createCard` invocation). The `ParsedCard` shape gains `kind`; the parser reads `rec.kind`; the call passes `kind` through.
- `scripts/db/seed-content.ts:49-58` (`SeedScenario` interface). Gains an optional `assessmentMethods` field with a default of `['scenario']` in the seeder that writes these rows.
- `libs/bc/study/src/scenarios.ts:199` -- `createScenario`. Gains an optional `assessmentMethods` parameter; passes through into the `scenario` insert with the `[ASSESSMENT_METHODS.SCENARIO]` default.
- `libs/bc/study/src/cards.ts:104` -- `createCard`. Gains an optional `kind` parameter; passes through into the `card` insert with the `CARD_KINDS.RECALL` default.

## In Scope

1. **`card.kind` column.** Add a `kind` text column to `study.card`. Allowed values are a closed enum (recommended subset of `ASSESSMENT_METHODS` -- see Open Question (a)): `recall | calculation`. NOT NULL DEFAULT `'recall'`. A new `libs/constants/src/study.ts` enum `CARD_KINDS` with values `RECALL = 'recall'` and `CALCULATION = 'calculation'` (matching the `ASSESSMENT_METHODS` strings exactly). Drizzle CHECK constraint enforces the enum. New index `card_user_kind_idx` on `(user_id, kind)` so per-kind queries don't fan out across the user's whole card pool.

2. **`scenario.assessment_methods` jsonb column.** Add an `assessment_methods` jsonb column to `study.scenario`, typed `AssessmentMethod[]`. NOT NULL DEFAULT `'["scenario"]'::jsonb`. Validation (in BC, since CHECK on jsonb arrays is awkward): every entry must be in `ASSESSMENT_METHOD_VALUES`; the array is non-empty; entries are unique. The default `["scenario"]` matches today's "every rep is judgment" behavior so the cutover is safe. A scenario can declare multiple methods (recommended yes per Open Question (b)): a hybrid maneuver scenario carries `["scenario","demonstration"]` and contributes to both gates.

3. **`SESSION_ITEM_KINDS.TEACHING_EXERCISE` enum value.** Add `TEACHING_EXERCISE = 'teaching-exercise'` to the `SESSION_ITEM_KINDS` constant in `libs/constants/src/study.ts`. Update the `session_item_result.item_kind` CHECK constraint via a migration that drops + recreates the constraint with the expanded value list. Recommended single value (Open Question (c)) -- `teaching-exercise` covers both explanation and demonstration modalities; the modality lives on the exercise's own metadata (a follow-on content-authoring WP defines the metadata shape).

4. **Backfill strategy.** No data migration is needed beyond the column defaults:

   - Every existing `card` row gets `kind='recall'` via the column default. Recall is the dominant card kind today; the assumption is safe. The yaml-cards authoring path (which today emits cards with no `kind` field) starts emitting `kind='recall'` explicitly so future-author intent is captured rather than left to the column default.
   - Every existing `scenario` row gets `assessment_methods=['scenario']` via the column default. This matches the existing `mastery.ts` behavior where every rep contributes to the scenario gate. Authoring-time updates flip specific scenarios to `["demonstration"]` or `["scenario","demonstration"]` over time; that's content work, not migration work.
   - `session_item_result` has zero rows that would need `item_kind='teaching-exercise'`. The new value is forward-only -- historical rows stay on `card | rep | node_start`. No backfill, no shim.

   The migration ships as a single Drizzle file `0002_evidence_kind_data_layer.sql`. The migration baseline was collapsed in PR #445 (and updated in PR #449), so the live migrations directory currently holds `0000_initial.sql` + `0001_hangar_invitation.sql`; this WP appends `0002_*`. No consolidation. Important: per `drizzle/README.md`, this project uses `drizzle-kit push` (not `migrate`) for both dev resets and the hosted deploy. The `0002_*` SQL file ships for diff-accuracy / future-migrate-path-revival -- it is not the runtime apply path. The TS schema in `libs/bc/study/src/schema.ts` is the source of truth; `bun run db reset` rebuilds from it.

5. **Authoring tooling.**

   - **yaml-cards parser** (`scripts/db/seed-cards.ts`): the existing `ParsedCard` shape gains an optional `kind?: CardKind` field. When unset, defaults to `recall`. A new `kindSet` validates the parsed value before insert. node.md authors who want a calculation card add `kind: calculation` to the yaml-cards entry; everything else stays as recall.
   - **Scenario seed shape** (`scripts/db/seed-content.ts`): the in-memory `ScenarioRecord` gains an optional `assessmentMethods?: AssessmentMethod[]` field. When unset, defaults to `['scenario']`. The seed script writes the value through to the column. Existing scenarios get the default and read as judgment-only reps; explicit values flow through as authored.
   - **Hangar card editor** (`apps/hangar/src/routes/cards/[id]/+page.svelte` -- if a card editor exists; otherwise the work is to surface the field on the relevant authoring route): a select with `recall | calculation`. Default `recall` on new cards. Required on save.
   - **Hangar scenario editor** (same pattern): a multi-select / checkbox group over `ASSESSMENT_METHOD_VALUES` (filtered to the four methods that make sense on a scenario: `scenario | demonstration | recall | calculation` -- recall and calculation are unusual on a scenario but allowed for the exotic case of "this scenario is a calculation problem dressed up as a decision rep"; teaching is excluded since teaching-exercises are a different session item kind, not a scenario kind). Default `['scenario']`. Required non-empty on save.
   - **Tasks.md** lists the exact authoring routes / files touched. Phase 3 surfaces the file list.

   YAML-only mirrors (any `course/firc/...yaml` files that author scenarios -- there are no such files today; FIRC scenarios live as markdown scenario specs, not authored yaml) gain the new field with a default at parse time. Phase 3 surfaces a sanity-check script that lists every persisted scenario and its current `assessment_methods` value, flagging the rows that have the default applied vs an explicit value (Open Question (d)).

6. **Mastery-layer wire-up.** `libs/bc/study/src/mastery.ts` `getNodeEvidenceStateMap` switches its three `not_applicable` shims to real computations:

   - `recall` gate: filter cards by `kind='recall'`, then run the existing `computeCardGate` over the filtered cards. The cards-attached count drives `not_applicable` (zero recall cards on the node).
   - `calculation` gate: filter cards by `kind='calculation'`, run `computeCardGate` over the filtered set. Zero calculation cards => `not_applicable`.
   - `scenario` gate: filter reps by their scenario's `assessment_methods` array containing `'scenario'`. The existing `computeRepGate` runs over the filtered set. Zero matching scenarios attached => `not_applicable`.
   - `demonstration` gate: filter reps by their scenario's `assessment_methods` containing `'demonstration'`. Same gate logic. Zero matching => `not_applicable`.
   - `teaching` gate: aggregate `session_item_result` rows where `itemKind = 'teaching-exercise'` AND completed AND not skipped, joined to the node via `teaching_exercise.node_id`. Treats teaching-exercise results like reps -- count + accuracy via `computeRepGate`, with the same threshold. A node with zero teaching-exercise rows => `teaching=not_applicable`.

   The wire-up rewrites the three `not_applicable` constants in `getNodeEvidenceStateMap`. The `getNodeEvidenceState` single-node helper continues to delegate to the map function. The leaf-mastery aggregation in `aggregateLeafKindStates` is unchanged -- it already takes per-kind gate states as input and aggregates correctly; the data behind those states is what changes.

7. **Teaching-exercise table design.** `teaching-exercise` is a session item kind, but the runtime needs *something* to attach the item kind to. Two options (Open Question (e)):

   - **(e1, recommended)** A new `study.teaching_exercise` table that mirrors `scenario`'s shape: `id`, `user_id`, `title`, `prompt` (the concept the candidate has to teach), `node_id` (link to the knowledge graph), `is_editable`, `seed_origin`. `session_item_result` gains a `teaching_exercise_id text` column (nullable, set null on delete) so a row with `item_kind='teaching-exercise'` resolves to the underlying exercise. The teaching gate query joins via this column.
   - **(e2)** No new table; teaching-exercises ride on the existing `scenario` table with `assessment_methods=['teaching']`. Pro: zero schema. Con: scenarios are decision reps with options + correct answer + whyNot rationale; a teaching-exercise is a free-response prompt. Reusing the table forces a NULL options shape and breaks the scenario invariant ("exactly one correct option per scenario").

   Recommended: (e1). New table, real shape, real foreign key.

8. **Constants and types.** `libs/constants/src/study.ts` additions:

   - `CARD_KINDS = { RECALL: 'recall', CALCULATION: 'calculation' } as const`
   - `CardKind` type
   - `CARD_KIND_VALUES` array
   - `CARD_KIND_LABELS` for UI
   - Updated `SESSION_ITEM_KINDS` with `TEACHING_EXERCISE: 'teaching-exercise'`
   - `SCENARIO_DEFAULT_ASSESSMENT_METHODS = [ASSESSMENT_METHODS.SCENARIO] as const` -- the default applied on insert when authoring tools don't set the field (matches the column default).

   `libs/types/src/index.ts`: re-export `CardKind` from `@ab/constants` if external consumers need it.

9. **Schema additions** (recap, with exact migration shape). The TS schema in `libs/bc/study/src/schema.ts` is authored first; `drizzle-kit generate` produces the SQL below into `drizzle/0002_evidence_kind_data_layer.sql` for diff-accuracy. `bun run db reset` rebuilds from TS via `drizzle-kit push` -- the SQL file is not the runtime apply path.

   ```sql
   -- 0002_evidence_kind_data_layer.sql

   ALTER TABLE study.card
       ADD COLUMN kind text NOT NULL DEFAULT 'recall';
   ALTER TABLE study.card
       ADD CONSTRAINT card_kind_check CHECK ("kind" IN ('recall', 'calculation'));
   CREATE INDEX card_user_kind_idx ON study.card ("user_id", "kind");

   ALTER TABLE study.scenario
       ADD COLUMN assessment_methods jsonb NOT NULL DEFAULT '["scenario"]'::jsonb;
   -- BC-level validation enforces values in ASSESSMENT_METHOD_VALUES + non-empty + unique.

   ALTER TABLE study.session_item_result
       DROP CONSTRAINT sir_item_kind_check;
   ALTER TABLE study.session_item_result
       ADD CONSTRAINT sir_item_kind_check
       CHECK ("item_kind" IN ('card', 'rep', 'node_start', 'teaching-exercise'));

   CREATE TABLE study.teaching_exercise (
       id text PRIMARY KEY,
       user_id text NOT NULL REFERENCES bauth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
       title text NOT NULL,
       prompt text NOT NULL,
       domain text NOT NULL,
       node_id text REFERENCES study.knowledge_node(id) ON DELETE SET NULL,
       is_editable boolean NOT NULL DEFAULT true,
       status text NOT NULL DEFAULT 'active',
       seed_origin text,
       created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX teaching_exercise_user_node_idx
       ON study.teaching_exercise ("user_id", "node_id");

   ALTER TABLE study.session_item_result
       ADD COLUMN teaching_exercise_id text REFERENCES study.teaching_exercise(id) ON DELETE SET NULL;
   ```

10. **Tests.** Per Open Question (f), `mastery.test.ts` (already exists for WP B) is extended with the per-kind gate paths now that the shims are real:

    - A card-only learner with three mastered `kind='recall'` cards on node N: `recall=pass`, `calculation=not_applicable`. K leaf linked to N (no `requires_teaching`) is mastered.
    - A card-only learner with three mastered `kind='calculation'` cards on node N: `recall=not_applicable`, `calculation=pass`. K leaf linked to N reads as not-mastered (recall is the K-leaf required kind in the recommended mapping); `missingKinds=['recall']`.
    - A judgment-rep-only learner against a scenario with `assessment_methods=['scenario']`: `scenario=pass`, `demonstration=not_applicable`. R leaf linked to N is mastered (recommended R requires `[scenario]`); S leaf linked to N is not mastered until either demonstration or scenario evidence on a `["demonstration"]`-tagged scenario clears.
    - A judgment-rep-only learner against a scenario tagged `['scenario','demonstration']`: both gates count the same reps. `scenario=pass`, `demonstration=pass` (assuming threshold). The hybrid scenario satisfies both kinds.
    - A CFI learner with three completed `teaching-exercise` rows on node N (joined via the new `teaching_exercise.node_id`): `teaching=pass`. A K leaf with `requires_teaching=true` and the same K cards mastered reads as mastered. Same K leaf without the teaching exercises reads as not-mastered with `missingKinds=['teaching']`.
    - The card-only learner from the existing WP B test (a learner who masters cards on the linked node of an `S` leaf) still reads as not-mastered after this WP (`missingKinds` was `['demonstration', 'scenario']` under WP B; stays the same since pure recall cards don't satisfy a skill leaf).

    Tests cover both the BC unit level (per-kind gate functions in isolation, partition queries) and the integration level (`isLeafMastered` against seeded users + cards + scenarios + teaching-exercise rows).

11. **YAML / authoring sanity-check script.** `scripts/sources/check-scenario-assessment-methods.ts` (or extending the existing `scripts/db.ts` dispatcher with a `check scenario-assessment-methods` subcommand) walks every scenario in the DB and reports rows where `assessment_methods` equals the default `['scenario']` vs rows where authoring updated the column. Output is informational -- it surfaces "you have N scenarios that haven't been audited for their actual assessment method" so the content team has a punch list. Same shape for cards: `check card-kinds` lists per-author / per-domain card-kind distributions.

12. **CFI ACS-25 transcription explicitly out of scope.** The actual content authoring that flips `requires_teaching=true` on CFI ACS-25 leaves and authors teaching-exercise rows for those leaves is a separate WP. This data-layer WP delivers (a) the column to flag (already shipped in WP B), (b) the table to attach exercises to (this WP), and (c) the session-item-kind to record their results (this WP). The CFI ACS-25 authoring WP fills (a)+(b)+(c) with real content.

## Out of Scope (explicit)

- **CFI ACS-25 transcription / teaching-exercise content.** The actual authoring of teaching exercises and the per-leaf `requires_teaching=true` flips for CFI leaves is a downstream content WP. This WP only ships the substrate.
- **Teaching-exercise UX / runtime / session pickup.** No engine work to *select* teaching-exercises into a session, no UI for the candidate to perform one. The WP adds the session-item-kind so a *future* engine WP can pick them. v1 ships read-side mastery aggregation only -- if seed data hand-inserts teaching-exercise rows + session_item_result rows, the gate computes against them, but the live session pipeline doesn't generate them yet.
- **Per-card / per-scenario bloom tagging.** The leaf's `required_bloom` already exists; whether per-card / per-scenario evidence reaches the bloom level is a separate dimension beyond per-kind partitioning. Out of scope here.
- **Engine selection changes.** WP B was explicit: the engine continues to pick from cards + scenarios as today. Same applies here. Wiring "engine picks calculation cards when a leaf is missing calculation evidence" is a follow-on engine WP.
- **Per-kind threshold tunings.** `CARD_MIN`, `REP_MIN`, `CARD_MASTERY_RATIO_THRESHOLD`, `REP_ACCURACY_THRESHOLD` stay global. Per-kind tunings (e.g. "scenario reps want a higher minimum") are deferred -- ship the partitioning first, tune later if data demands it.
- **Renaming `card.cardType`.** The existing `card_type` column (`basic | cloze | regulation | memory_item`) describes presentation form, not knowledge kind. It stays. The new `card.kind` column lives alongside it.
- **Migration of `assessment_methods` between knowledge_node and scenario.** `knowledge_node.assessment_methods` (already shipped) describes which methods are *valid* for evaluating that node. `scenario.assessment_methods` (this WP) describes which methods *this specific scenario* implements. Different concepts; both stay. No migration to merge them.
- **Multi-tenant isolation of teaching-exercise content.** Teaching-exercise rows carry `user_id` like cards / scenarios; cross-user sharing follows the same path (out of scope).

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Before this WP (post WP B)                                          │
│    card                                                              │
│      card_type:    basic|cloze|regulation|memory_item (presentation) │
│      no `kind` column                                                │
│    scenario                                                          │
│      no `assessment_methods` column                                  │
│    session_item_result                                               │
│      item_kind:    card|rep|node_start                               │
│        |                                                             │
│        v                                                             │
│    getNodeEvidenceStateMap (mastery.ts)                              │
│      recall:        every card on node                               │
│      calculation:   not_applicable (shim)                            │
│      scenario:      every rep on node                                │
│      demonstration: not_applicable (shim)                            │
│      teaching:      not_applicable (shim)                            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  After this WP                                                       │
│    card                                                              │
│      card_type:    basic|cloze|regulation|memory_item (unchanged)    │
│      kind:         recall|calculation (NEW, default 'recall')        │
│    scenario                                                          │
│      assessment_methods: jsonb AssessmentMethod[]                    │
│                          (NEW, default ['scenario'])                 │
│    teaching_exercise                                                 │
│      id, user_id, title, prompt, node_id, ... (NEW table)            │
│    session_item_result                                               │
│      item_kind: card|rep|node_start|teaching-exercise (expanded)     │
│      teaching_exercise_id: FK (NEW, nullable)                        │
│        |                                                             │
│        v                                                             │
│    getNodeEvidenceStateMap (rewired)                                 │
│      recall:        cards filtered to kind='recall'                  │
│      calculation:   cards filtered to kind='calculation'             │
│      scenario:      reps filtered to scenario.methods includes       │
│                     'scenario'                                       │
│      demonstration: reps filtered to scenario.methods includes       │
│                     'demonstration'                                  │
│      teaching:      session_item_result.item_kind='teaching-exercise'│
│                     joined to teaching_exercise.node_id              │
│        |                                                             │
│        v                                                             │
│    isLeafMastered (unchanged shape, real data flows in)              │
└──────────────────────────────────────────────────────────────────────┘
```

## Behavior

### Per-kind cards partition

Each (user, node) cards query in `getNodeEvidenceStateMap` runs twice (one per `CARD_KINDS` value), or once with a `kind` group-by. Recommended: one query, group by `(node_id, kind)`, sum totals + mastered counts per group. The per-kind row count drives `computeCardGate(total, ratio)` for that kind. Zero rows for a kind on a node => the kind reports `not_applicable` for that node.

### Per-kind scenarios partition

Each (user, node) reps query joins through `scenario` and reads `scenario.assessment_methods`. The aggregation splits by method: a scenario tagged `['scenario','demonstration']` contributes the same rep attempts to both kinds' counts. Implementation: `LATERAL UNNEST(scenario.assessment_methods)` (cast through `jsonb_array_elements_text`) to expand the array, group by `(scenario.node_id, method)`. Zero matching reps for a method on a node => method reports `not_applicable`.

### Teaching-exercise gate

A teaching-exercise session_item_result row has `item_kind='teaching-exercise'` and `teaching_exercise_id` set. The gate query joins through `teaching_exercise.node_id` to scope per-node. Treats teaching-exercise results like reps -- count + accuracy via `computeRepGate`, with the same threshold. A node with zero teaching-exercise rows => `teaching=not_applicable`.

### Backfill path on existing data

- `card.kind`: every existing row picks up `'recall'` via the column default. The CHECK constraint applies to all rows on commit.
- `scenario.assessment_methods`: every existing row picks up `'["scenario"]'::jsonb` via the column default.
- `session_item_result.item_kind`: existing rows are `card | rep | node_start`; the expanded CHECK accepts those plus the new value. Drop + recreate.
- `teaching_exercise`: empty on cutover. Seed data populates it as authored.
- `session_item_result.teaching_exercise_id`: nullable, defaults NULL. Set only on rows where `item_kind='teaching-exercise'` (BC-level invariant -- tasks.md Phase 4 adds the CHECK that ties the two).

### Engine pickup -- read-only for now

The engine (per WP B) does not change. Sessions still emit `card | rep | node_start`. Teaching-exercise rows enter the system either through (a) seed data for testing, or (b) a future authoring + engine WP. The mastery rollup reads them when present; absence means the teaching gate stays `not_applicable` for everyone, which is the WP B baseline anyway.

## BC Surface

`libs/bc/study/src/mastery.ts` -- existing functions, real partitions:

| Function                  | Change                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getNodeEvidenceStateMap` | Three new partition queries (cards by kind, reps by scenario method via LATERAL UNNEST, teaching-exercises via `teaching_exercise` join). Replaces three `NOT_APPLICABLE` constants with computed `GateState`s. |
| `getNodeEvidenceState`    | Unchanged -- delegates to map fn.                                                                                                                                                                               |
| `aggregateLeafKindStates` | Unchanged -- shape stays; data quality improves.                                                                                                                                                                |
| `isLeafMastered`          | Unchanged shape.                                                                                                                                                                                                |
| `getLeafMasteryStateMap`  | Unchanged shape.                                                                                                                                                                                                |

`libs/bc/study/src/teaching-exercises.ts` (NEW): CRUD for the new table. Mirrors `libs/bc/study/src/scenarios.ts`'s shape:

| Function                 | Signature                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `getTeachingExercises`   | `(userId: string, opts?: { nodeId?: string }, db?: Db) -> Promise<TeachingExerciseRow[]>`    |
| `getTeachingExercise`    | `(id: string, db?: Db) -> Promise<TeachingExerciseRow \| null>`                              |
| `createTeachingExercise` | `(userId: string, input: NewTeachingExerciseInput, db?: Db) -> Promise<TeachingExerciseRow>` |
| `updateTeachingExercise` | `(id: string, patch: TeachingExercisePatch, db?: Db) -> Promise<TeachingExerciseRow>`        |
| `deleteTeachingExercise` | `(id: string, db?: Db) -> Promise<void>`                                                     |

`libs/bc/study/src/cards.ts` (existing) -- one new helper:

| Function                    | Change                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `createCard` / `updateCard` | Accept optional `kind: CardKind`; default `recall` on create.                             |
| `getCardsForNodeByKind`     | NEW: `(userId, nodeId, kind, db?) -> Promise<CardRow[]>` -- powers the partitioned query. |

`libs/bc/study/src/scenarios.ts` (existing):

| Function                            | Change                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `createScenario` / `updateScenario` | Accept optional `assessmentMethods: AssessmentMethod[]`; default `['scenario']` on create. Validates non-empty + values in enum + unique. |
| `getScenariosForNodeByMethod`       | NEW: `(userId, nodeId, method, db?) -> Promise<ScenarioRow[]>` -- powers the partitioned query.                                         |

### Errors

- `InvalidCardKindError` -- thrown by `createCard` / `updateCard` when `kind` is set to a value outside `CARD_KIND_VALUES`. Schema CHECK is the second line of defense.
- `InvalidAssessmentMethodError` -- thrown by `createScenario` / `updateScenario` when `assessmentMethods` contains a value outside `ASSESSMENT_METHOD_VALUES`, is empty, or has duplicates.
- `TeachingExerciseNotFoundError` -- standard.

## Constants

`libs/constants/src/study.ts` additions:

```typescript
/**
 * Card knowledge-kind axis. Distinct from CARD_TYPES (basic/cloze/...) which
 * describes presentation form. CARD_KINDS describes what knowledge the card
 * tests so the per-evidence-kind gate (mastery.ts) can partition recall vs
 * calculation evidence on a node. Subset of ASSESSMENT_METHODS -- cards never
 * carry scenario / demonstration / teaching kinds (those live on scenarios
 * and teaching-exercises).
 */
export const CARD_KINDS = {
	RECALL: 'recall',
	CALCULATION: 'calculation',
} as const;

export type CardKind = (typeof CARD_KINDS)[keyof typeof CARD_KINDS];

export const CARD_KIND_VALUES = Object.values(CARD_KINDS);

export const CARD_KIND_LABELS: Record<CardKind, string> = {
	[CARD_KINDS.RECALL]: 'Recall',
	[CARD_KINDS.CALCULATION]: 'Calculation',
};

/**
 * Default assessment_methods array applied to a scenario when authoring tools
 * leave the field unset. Matches the column default ('["scenario"]'::jsonb).
 * Authoring tools that want a different shape pass an explicit value.
 */
export const SCENARIO_DEFAULT_ASSESSMENT_METHODS: readonly AssessmentMethod[] = [ASSESSMENT_METHODS.SCENARIO];
```

`SESSION_ITEM_KINDS` update:

```typescript
export const SESSION_ITEM_KINDS = {
	CARD: 'card',
	REP: 'rep',
	NODE_START: 'node_start',
	TEACHING_EXERCISE: 'teaching-exercise',
} as const;
```

## Routes

No new routes for the engine / runtime. Hangar authoring routes are already in scope (existing card editor / scenario editor pages). A future content-authoring WP for teaching-exercises will own its own editor route -- not this WP.

## Validation

| Field / surface                                       | Rule                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `card.kind`                                           | NOT NULL, CHECK in CARD_KIND_VALUES.                                                                                                   |
| `scenario.assessment_methods`                         | jsonb array. BC-level: non-empty, every entry in ASSESSMENT_METHOD_VALUES, no duplicates. Default applies on insert when caller omits. |
| `session_item_result.item_kind = 'teaching-exercise'` | Allowed by expanded CHECK. BC-level: when set, `teaching_exercise_id` MUST also be set.                                                |
| `session_item_result.teaching_exercise_id`            | Nullable FK. BC-level: when set, `item_kind` MUST be `'teaching-exercise'`.                                                            |
| `teaching_exercise.title` / `prompt`                  | Non-empty strings.                                                                                                                     |
| `teaching_exercise.node_id`                           | Optional FK to `knowledge_node.id`. NULL = personal / unattached exercise (mirrors card.nodeId / scenario.nodeId).                     |
| YAML-cards parser `kind` field                        | When present: must be in CARD_KIND_VALUES. When absent: defaults to `'recall'`.                                                        |
| Scenario seed `assessmentMethods` field               | When present: must be a non-empty subset of ASSESSMENT_METHOD_VALUES with unique entries. When absent: defaults to `['scenario']`.     |

## Edge cases

- **A card row migrated from pre-WP main with no `kind` value.** Column default applies (`'recall'`). The CHECK constraint accepts the value. No author intent is captured retroactively -- if the author meant calculation, the kind is wrong until edited. Sanity-check script (item 11) surfaces the per-domain distribution so the content team can audit.
- **A scenario seeded with `assessmentMethods=['scenario','demonstration']`.** Both kinds count the same reps. Threshold logic is per-kind independent. Same rep contributes to both gates' totals. By design.
- **A scenario authored with `assessmentMethods=[]` (empty).** BC validator rejects on insert / update. The migration's column default prevents empty rows on backfill.
- **A scenario authored with duplicate methods (`['scenario','scenario']`).** BC validator rejects.
- **A `session_item_result` row with `item_kind='teaching-exercise'` and NULL `teaching_exercise_id`.** Schema doesn't reject (nullable FK). BC-level invariant rejects on insert / update; the teaching gate query falls back to ignoring such rows. Phase 4 adds a CHECK that ties the two: `(item_kind = 'teaching-exercise') = (teaching_exercise_id IS NOT NULL)`.
- **A teaching-exercise with `node_id=NULL`.** Personal teaching-exercise (mirrors personal cards). Doesn't contribute to any node's gate (gate aggregates by node). Visible to the user but not part of the rollup.
- **A node with both recall and calculation cards but only recall ones meet threshold.** `recall=pass`, `calculation=fail` (or `insufficient_data` depending on counts). `aggregateLeafKindStates` for a K leaf reads recall as the required kind; the leaf is mastered. The calculation gate's status is reflected in `byEvidenceKind` for richer rollups but doesn't block the K mastery.
- **A learner who masters only `calculation` cards on a K leaf (which requires `recall`).** Per the recommended K=`recall` mapping, the leaf is not mastered. `missingKinds=['recall']`. The calculation work was useful for a future K-with-calc-extension leaf but doesn't alone satisfy K.
- **A scenario tagged `['demonstration']` only.** Reps on it don't count toward the scenario gate. An R leaf (which requires `[scenario]` per the recommended mapping) is not mastered by demonstration-only reps. Author intent matters: if the rep is judgment + demo, tag it `['scenario','demonstration']`.
- **The migration runs against a DB with millions of cards.** Drizzle's ALTER TABLE ADD COLUMN with DEFAULT in PostgreSQL >= 11 is metadata-only (no rewrite) -- the default is materialized lazily on read. The CHECK constraint validates against new + existing rows on creation. Migration time is bounded by the CHECK validation, not the column addition.
- **Existing tests in `mastery.test.ts` (WP B) that expected `calculation=not_applicable` etc.** Those tests now reflect real partitions and may need updates. Phase 5 audits + updates them. The semantic of the existing card-only-on-S-leaf test still holds: pure recall cards still don't satisfy a skill leaf.
- **A card with `card_type='regulation'` and `kind='calculation'`.** The two axes are independent. A regulation card can test calculation (e.g. "compute the cone of confusion height for a VOR at 60 NM, citing AIM 1-1-3"). Both axes co-exist on the same card row.

## Open Questions -- resolved 2026-05-03

The user signed "do the right thing" defaults; every recommended answer below is the chosen resolution. Re-opening any of these requires a spec amendment.

### (a) `card.kind` enum -- subset or full ASSESSMENT_METHODS?

**Recommended: subset (`recall | calculation`).**

| Option                                                           | For                                                                                                                                                                                                                                                                | Against                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subset (`recall \| calculation`) (recommended)                   | Cards are recall or calculation; never scenarios, demos, or teaching. The smaller enum prevents authoring confusion. Values still match `ASSESSMENT_METHODS` strings exactly so the partition query is a string compare.                                          | Adds a separate constant to maintain alongside `ASSESSMENT_METHODS`. If a future card kind appears (e.g. `oral`), both must update.                  |
| Full `ASSESSMENT_METHODS` (`recall \| calc \| scn \| dem \| tch`) | Single source of truth for the enum. No duplication.                                                                                                                                                                                                              | Authoring tooling has to filter the dropdown to "kinds that make sense on a card." Schema CHECK can't enforce the subset without duplicating values. |

Resolution to recommend: smaller subset, named `CARD_KINDS`, values matching the relevant `ASSESSMENT_METHODS` strings exactly.

### (b) `scenario.assessment_methods` cardinality -- single or array?

**Recommended: array (multiple methods per scenario).**

| Option                            | For                                                                                                                                                                                                                                                                  | Against                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Array (recommended)               | A hybrid maneuver scenario covers both judgment and demonstration; tagging it `['scenario','demonstration']` lets the same rep contribute to both gates. Matches `knowledge_node.assessment_methods` shape, which is also an array.                                  | Authoring tools need a multi-select. Slightly more complex query (LATERAL UNNEST).                                 |
| Single (`assessment_method` text) | Simpler schema. Single CHECK constraint.                                                                                                                                                                                                                              | Hybrid scenarios are a real authoring case. Forces fan-out into separate scenario rows for the dual-purpose case. |

Resolution to recommend: jsonb array, `AssessmentMethod[]`, default `['scenario']`.

### (c) Session-item-kind for teaching -- single or split by modality?

**Recommended: single `teaching-exercise`. Modality lives on `teaching_exercise` row metadata.**

| Option                                                   | For                                                                                                                                                                                                                                              | Against                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single `teaching-exercise` (recommended)                 | The session-item-kind is "the candidate did a teaching activity." Whether they explained or demonstrated is metadata on the exercise itself, not a different rollup-axis kind.                                                                  | Loses the ability to partition the teaching gate further. The recommended mapping doesn't need that partition; principle 9 names "teaching" as one kind. |
| Split (`teaching-explanation`, `teaching-demonstration`) | Finer-grained data on the rep stream. A future analytic could slice by modality.                                                                                                                                                                | Doubles the enum. The teaching gate aggregates them anyway. Modality belongs on the exercise's prompt shape, not the session-item type.                  |

Resolution to recommend: one new value, `TEACHING_EXERCISE: 'teaching-exercise'`.

### (d) Audit script for default-applied vs explicit `assessment_methods`

**Recommended: ship `bun run db check scenario-assessment-methods` as part of this WP. Output is informational, not blocking.**

| Option                                   | For                                                                          | Against                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Ship the script in this WP (recommended) | Surfaces the audit punch list immediately; content team has data to act on.  | Adds tooling work to the WP scope. Small cost.                                              |
| Defer to a content-authoring WP          | Keeps this WP scoped to schema + BC.                                         | Punts visibility -- the team won't know which scenarios still have the default until later. |

Resolution to recommend: ship with the WP. Same shape for `bun run db check card-kinds`.

### (e) Teaching-exercise table -- new or reuse scenario?

**Recommended: new `study.teaching_exercise` table.**

| Option                                       | For                                                                                                                                                                       | Against                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| New table (recommended)                      | Teaching-exercises are free-response prompts; scenarios are decision-options-with-correct-answer. Different invariants, different validation. Clean shape per kind.       | One more table.                                                                                           |
| Reuse `scenario` with `methods=['teaching']` | Zero new schema.                                                                                                                                                          | Forces NULL options on teaching rows; breaks `scenario_option_correct_unique`; muddies authoring tooling. |

Resolution to recommend: new table.

### (f) Where do the new gate computations live?

**Recommended: extend `mastery.ts`. The shims become real; no new file.**

| Option                            | For                                                                                                                                                  | Against                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Extend `mastery.ts` (recommended) | The per-kind gate functions already live there. The shims documented in the file header become real partitions in place. Tight coupling.            | `mastery.ts` grows. Manageable -- additions are partition queries + helpers, not new top-level fns.                    |
| New `evidence-partitions.ts`      | Separates the "compute the partition" step from "apply the gate." Cleaner module boundary.                                                           | Extra indirection for one consumer (`getNodeEvidenceStateMap`). Premature -- second consumer may never appear.         |

Resolution to recommend: extend `mastery.ts`.

## Migration considerations

- **Single Drizzle migration** at `0002_evidence_kind_data_layer.sql`, sequence number after WP B. No consolidation. Adds three column changes + one CHECK swap + one new table.
- **Column defaults handle backfill.** No manual UPDATE. PostgreSQL >= 11 metadata-only ALTER for `card.kind` and `scenario.assessment_methods` (both have DEFAULT clauses in the ADD COLUMN).
- **CHECK swap on `session_item_result.item_kind`.** DROP + ADD is the supported path. The expanded check accepts the existing values plus `teaching-exercise`. No data motion.
- **New `teaching_exercise` table.** Empty on cutover. The `session_item_result.teaching_exercise_id` column is nullable so existing rows pass.
- **No FSRS impact.** Scheduling reads card and scenario by id; both still resolve.
- **Existing `mastery.test.ts` tests.** Some expectations change: `calculation` and `demonstration` are no longer hard `not_applicable`. The "card-only learner on S leaf" test still passes (pure recall cards still don't satisfy demonstration / scenario). Phase 5 audits the test file and updates the cases that were keyed to the shim values.
- **Audit script as part of cutover.** Run `bun run db check scenario-assessment-methods` and `bun run db check card-kinds` post-migration to verify no rows have unexpected NULL or out-of-enum values.

## Risks

| Risk                                                                                                                                                              | Mitigation                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing cards default to `kind='recall'` but some are actually calculation; learners on calc-heavy nodes appear to have recall coverage they don't.              | Audit script (`bun run db check card-kinds`) surfaces the per-domain distribution post-migration. Content team flips wrong rows. Until then the system over-credits recall on calc-heavy nodes -- the inverse of WP B's improvement, scoped to nodes with mostly-calc cards.                                                |
| Existing scenarios default to `['scenario']` but some are actually demonstrations.                                                                                | Same audit pattern (`bun run db check scenario-assessment-methods`). Content team flips wrong rows.                                                                                                                                                                                                                         |
| Hangar authoring tooling lands later than the schema.                                                                                                             | Phase 3 ships the authoring + the schema together. If schema lands without the editor, authors can still update via direct SQL or seed-file edits; the column default keeps inserts working.                                                                                                                                |
| Session-item kind expansion breaks downstream code that exhaustively switches on `SESSION_ITEM_KINDS`.                                                            | TypeScript exhaustive `switch` checks fail at compile time -- consumers update or get a `bun run check` error. Phase 5 grep audits every consumer.                                                                                                                                                                          |
| Teaching-exercise rollup never gets used because no teaching exercises ever get authored.                                                                         | Acceptable -- the data layer doesn't degrade if the table stays empty. Teaching gate stays `not_applicable` for everyone, equivalent to WP B today. The point is the substrate is there for the CFI ACS-25 transcription WP to land on.                                                                                    |
| BC validation drift: a future caller writes `assessment_methods=[]` directly via Drizzle bypassing `createScenario`.                                              | The default applies on insert when the column is omitted; an explicit empty array bypasses the BC validator. Phase 4 adds a schema CHECK that enforces array length >= 1 via `jsonb_array_length`.                                                                                                                         |
| LATERAL UNNEST on `scenario.assessment_methods` is slow on large scenario tables.                                                                                 | The query runs once per `getNodeEvidenceStateMap` call (batched per credential rollup). The unnest is bounded by scenario count + per-row method count (typically 1 or 2). Add a GIN index on `assessment_methods` if profile shows it matters; not in v1.                                                                  |

## References

- [Design](./design.md)
- [Tasks](./tasks.md)
- [Test plan](./test-plan.md)
- [User stories](./user-stories.md)
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md)
- [Evidence Kind Gating spec](../evidence-kind-gating/spec.md)
- [Evidence Kind Gating PR #361](https://github.com/joshball/airboss/pull/361)
- [Engine Goal Cutover PR #353](https://github.com/joshball/airboss/pull/353)
