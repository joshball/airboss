---
title: 'Spec: Study Plan + Session Engine'
product: study
feature: study-plan-and-session-engine
type: spec
status: unread
review_status: pending
---

# Spec: Study Plan + Session Engine

A **Study Plan** captures WHAT a user wants to study (cert goals, focus domains, skip lists, session length). A **Session** is one instance of studying -- a time-boxed run that produces reviews, rep attempts, and node exploration. The **Session Engine** is the rule-based recommender that, given an active plan and the user's history, assembles the next batch of items to present.

v1 is MVP: single-user (Joshua is user zero), one active plan per user, rule-based prioritization with explicit weighted slices, no ML tuning. The engine is a deterministic function of plan + history + graph, not a black box.

Depends on: Spaced Memory Items (`study.card`, `study.card_state`, `study.review`), Decision Reps (`study.scenario`, `study.rep_attempt`), Knowledge Graph (node metadata, edges, mastery aggregation).

> **Depends on knowledge-graph spec.** This document assumes the graph exposes a queryable table of nodes with `id`, `domain`, `relevance[]` (cert/bloom/priority), `requires[]` node IDs, and a derivable per-user mastery score per node. The exact column names, mastery-computation rule, and query surface are being decided in parallel in `docs/work-packages/knowledge-graph/spec.md`. All integration points below that touch the graph are flagged for reconciliation once that spec lands.

## Data Model

All tables in the `study` Postgres schema namespace. IDs use `prefix_ULID` via `@ab/utils` `createId()`.

### study.study_plan

One active plan per user. Editable in place. History of plans is not tracked in v1 -- a plan is a mutable configuration, not an audit record.

| Column                 | Type        | Constraints                 | Notes                                                                                  |
| ---------------------- | ----------- | --------------------------- | -------------------------------------------------------------------------------------- |
| id                     | text        | PK                          | `plan_` prefix                                                                         |
| user_id                | text        | NOT NULL, FK identity       | Owner. One active plan per user, enforced by partial UNIQUE index.                     |
| title                  | text        | NOT NULL                    | Human-readable. Default: "Default Plan"                                                |
| status                 | text        | NOT NULL, DEFAULT 'active'  | From `PLAN_STATUSES` -- draft, active, archived                                        |
| cert_goals             | jsonb       | NOT NULL, DEFAULT '[]'      | Array of `Cert` values from `CERTS` (PPL, IR, CPL, CFI)                                |
| focus_domains          | jsonb       | NOT NULL, DEFAULT '[]'      | Array of domain slugs from `DOMAINS`                                                   |
| skip_domains           | jsonb       | NOT NULL, DEFAULT '[]'      | Array of domain slugs                                                                  |
| skip_nodes             | jsonb       | NOT NULL, DEFAULT '[]'      | Array of node IDs the user marked "skip permanently" or "skip topic"                   |
| depth_preference       | text        | NOT NULL, DEFAULT 'working' | From `DEPTH_PREFERENCES` -- surface, working, deep                                     |
| session_length         | smallint    | NOT NULL, DEFAULT 10        | Items per session. CHECK BETWEEN 3 AND 50                                              |
| default_mode           | text        | NOT NULL, DEFAULT 'mixed'   | From `SESSION_MODES` -- continue, strengthen, mixed, expand                            |
| created_at             | timestamptz | NOT NULL, DEFAULT now()     |                                                                                        |
| updated_at             | timestamptz | NOT NULL, DEFAULT now()     |                                                                                        |

> **Depends on knowledge-graph spec.** `skip_nodes` references node IDs. The ID format (kebab-case from ADR 011 vs `prefix_ULID` for any DB-built node table) is the graph spec's call; validation in the plan layer treats them as opaque strings.

### study.session

One row per session start. A session is complete when all presented items have attempts recorded OR the user explicitly ends it. A session may be abandoned (never completed); that shows as `completed_at IS NULL`.

| Column          | Type        | Constraints                    | Notes                                                                   |
| --------------- | ----------- | ------------------------------ | ----------------------------------------------------------------------- |
| id              | text        | PK                             | `ses_` prefix                                                           |
| user_id         | text        | NOT NULL, FK identity          |                                                                         |
| plan_id         | text        | NOT NULL, FK study.study_plan  | The plan this session was generated against                             |
| mode            | text        | NOT NULL                       | From `SESSION_MODES` -- the mode actually used (after overrides)        |
| focus_override  | text        | NULL                           | Domain slug if user chose focused session; NULL otherwise               |
| cert_override   | text        | NULL                           | Cert value if user narrowed cert for this session                       |
| session_length  | smallint    | NOT NULL                       | Target item count at generation                                         |
| items           | jsonb       | NOT NULL                       | Ordered array of `SessionItem` (see below) -- the committed batch       |
| started_at      | timestamptz | NOT NULL, DEFAULT now()        |                                                                         |
| completed_at    | timestamptz | NULL                           | NULL while in progress; set when user finishes or explicitly ends       |

### study.session_item_result

One row per attempted or skipped item. Links a session slot to the downstream review/attempt row it produced.

| Column         | Type        | Constraints                | Notes                                                                  |
| -------------- | ----------- | -------------------------- | ---------------------------------------------------------------------- |
| id             | text        | PK                         | `sir_` prefix                                                          |
| session_id     | text        | NOT NULL, FK study.session |                                                                        |
| user_id        | text        | NOT NULL                   | Denormalized for index efficiency                                      |
| slot_index     | smallint    | NOT NULL                   | 0-based position in the original items array                           |
| item_kind      | text        | NOT NULL                   | From `SESSION_ITEM_KINDS` -- card, rep, node_start                     |
| slice          | text        | NOT NULL                   | From `SESSION_SLICES` -- continue, strengthen, expand, diversify       |
| reason_code    | text        | NOT NULL                   | From `SESSION_REASON_CODES` -- the label behind the pick               |
| card_id        | text        | NULL, FK study.card        | Populated when item_kind='card'                                        |
| scenario_id    | text        | NULL, FK study.scenario    | Populated when item_kind='rep'                                         |
| node_id        | text        | NULL                       | Populated when item_kind='node_start'                                  |
| review_id      | text        | NULL, FK study.review      | Set on successful card review                                          |
| rep_attempt_id | text        | NULL, FK study.rep_attempt | Set on successful rep attempt                                          |
| skip_kind      | text        | NULL                       | From `SESSION_SKIP_KINDS` -- today, topic, permanent                   |
| presented_at   | timestamptz | NOT NULL, DEFAULT now()    |                                                                        |
| completed_at   | timestamptz | NULL                       |                                                                        |

> **Depends on knowledge-graph spec.** `node_id` is a graph reference. Whether it's a FK to a `graph.node` table or free text depends on how the graph persists nodes. For v1 we treat it as text with application-layer validation.

### SessionItem shape (jsonb on study.session.items)

```typescript
type SessionItem =
	| { kind: 'card'; cardId: string; slice: SessionSlice; reasonCode: SessionReasonCode; reasonDetail?: string }
	| { kind: 'rep'; scenarioId: string; slice: SessionSlice; reasonCode: SessionReasonCode; reasonDetail?: string }
	| { kind: 'node_start'; nodeId: string; slice: SessionSlice; reasonCode: SessionReasonCode; reasonDetail?: string };
```

`reasonDetail` is an optional human-readable string ("rated Again yesterday", "prerequisites met") shown in the preview. `reasonCode` is the machine-readable enum used for analytics and grouping.

## Behavior

### Plan lifecycle

1. **First run.** User has no plan. Engine short-circuits with a "set up your plan" empty state. No implicit default plan is created server-side -- the wizard owns the data.
2. **Wizard.** `/plans/new` is the first-run wizard and the "create new plan" route. User picks cert goals, session length, focus domains, skip domains. Depth defaults to `working`. Submit creates a plan with `status='active'`.
3. **Active plan.** `/plans/:id` shows the plan, editable in place. Save updates in place.
4. **Archiving.** Setting status='archived' implies no active plan exists. The engine requires an active plan; archiving all plans leaves the user in the empty state. v1 does not support multiple plans simultaneously -- activating one archives the others in the same transaction.
5. **Skip lists accumulate.** When a user skips a node mid-session with "skip topic" or "skip permanently", the node is added to `skip_nodes` on the active plan. "Skip today" does not mutate the plan.

### Session lifecycle

1. **Start request.** User lands on `/session/start` (or clicks "Start my session" from `/memory`, `/reps`, or the dashboard). The page loads the active plan and renders the preview with default mode or a mode override from query string.
2. **Preview.** The engine runs (see below) and returns an ordered `items` array plus a human-readable preview. The user sees the N items with reasoning labels, grouped by slice.
3. **Adjust (optional).**
   - **Shuffle.** Re-run the engine with the same plan and filters but a new seed. Replaces the entire items array.
   - **Replace an item.** Drop one item, re-run the engine for just that slot with the same slice. Must not reintroduce items already in the batch.
   - **Change mode.** Re-run with a new mode. Replaces items array.
   - **Focus / cert override.** Re-run with the override applied.
4. **Commit.** User clicks Start. `study.session` row is created with the final items snapshot, `mode`, any overrides, and `started_at = now()`. `/sessions/:id` opens.
5. **Presentation loop.** Items are presented one at a time. Cards route through the existing Memory review UI; reps route through the existing Reps session UI; `node_start` items render a "Begin node" card that drops the user into the node detail page (Phase 1: Context) and counts as complete when the user advances past Context. On completion of each underlying action, the engine writes a `session_item_result` row with the downstream `review_id` / `rep_attempt_id`.
6. **Skip mid-session.** Three skip actions (today / topic / permanent). See "Skip semantics" below.
7. **Session summary.** When all items are resolved (attempted or skipped), the session page transitions to a summary: items attempted, correct count, avg confidence, domains covered, any nodes started, streak update, "Suggested next" hints.
8. **Abandonment.** If the user closes the tab, `completed_at` stays NULL. Returning later: the in-progress session is shown with a "Resume" option for `RESUME_WINDOW_MS` (2 hours) after `started_at`; beyond that, the engine offers a fresh session.

### Engine algorithm

The engine is a pure function: `plan + history + graph + mode + overrides + seed -> SessionItem[]`. Deterministic given the same inputs, which makes it testable and shuffle-able by varying the seed.

> **Depends on knowledge-graph spec.** Steps that read node metadata, edges, or per-user mastery are flagged below. The engine degrades gracefully: if the graph is absent or a node lookup fails, the affected slice narrows to the subset that does not require graph data.

#### Phase 1: Resolve inputs

1. Load active plan for user. If none, return empty array with a `needs_plan` signal.
2. Resolve effective filters:
   - `cert_filter` = `cert_override ?? plan.cert_goals`
   - `focus_filter` = `focus_override ? [focus_override] : plan.focus_domains`
   - `skip_filter` = `plan.skip_domains` (domains) + `plan.skip_nodes` (individual nodes)
3. Resolve weights from mode (see "Mode weights" below).
4. Resolve session_length from plan.

#### Phase 2: Build candidate pools

Each slice produces a scored candidate list. Scoring rules are explicit; no black-box model.

**Continue pool.** Items from domains touched in the last 2 completed sessions.

- Fetch last 2 `study.session` rows with `completed_at IS NOT NULL`.
- Collect domains across those sessions (from items' card/scenario/node domains).
- Candidates:
  - Due cards in those domains (`state IN ('learning', 'relearning', 'review')`, `due_at <= now()`).
  - Reps with attempts in the last 7 days that were incorrect OR below 60% accuracy over the last 5 attempts.
  - Nodes touched but not yet mastered.
- Score: `continueScore = domainRecencyWeight * 0.6 + dueUrgency * 0.4` where `domainRecencyWeight` is 1.0 for the most recent session's domains and 0.5 for the second-most-recent, and `dueUrgency` is normalized (overdue > due-today > near-due).
- `reasonCode`: `continue_recent_domain` | `continue_due_in_domain` | `continue_unfinished_node`

**Strengthen pool.** Items with dropping mastery signals.

- Due cards with state='relearning' (highest), state='review' with last rating = Again/Hard (medium), or state='review' overdue > 2x scheduled interval (medium-low).
- Reps with accuracy < 60% over last 5 attempts, or with a recent incorrect attempt.
- Nodes where per-user mastery decreased in the last 7 days (relative to 14 days ago).
- Score: `strengthenScore = masteryDropMagnitude + calibrationOverconfidence * 0.3` where `calibrationOverconfidence` is a tiebreaker boost when the user is overconfident in the item's domain (from Calibration read interfaces, when present).
- `reasonCode`: `strengthen_relearning` | `strengthen_rated_again` | `strengthen_overdue` | `strengthen_low_rep_accuracy` | `strengthen_mastery_drop`

> **Depends on knowledge-graph spec.** Per-node and per-domain mastery history are functions the graph spec will expose. This doc assumes `getNodeMastery(userId, nodeId) -> { score, trend }` and `getDomainMasteryTrend(userId, domain) -> { score, delta }`. If the graph spec names these differently, reconcile.

**Expand pool.** Nodes unstarted, prerequisites met, within cert filter.

- Fetch all nodes where:
  - The user has no card reviews, rep attempts, or node_start records attached, AND
  - All `requires` edges resolve to nodes the user has mastered (per the graph's mastery rule), AND
  - At least one `relevance[].cert` is in `cert_filter`, AND
  - The node's `domain` is not in `skip_filter`, AND
  - The node's `id` is not in `plan.skip_nodes`.
- Score: `expandScore = priorityWeight + focusMatch + bloomMatch` where `priorityWeight` is 1.0 / 0.6 / 0.2 for core / supporting / elective, `focusMatch` is +0.4 if the node's domain is in `focus_filter`, `bloomMatch` is +0.2 if a relevant bloom level matches `depth_preference`.
- `reasonCode`: `expand_unstarted_ready` | `expand_unstarted_priority` | `expand_focus_match`

> **Depends on knowledge-graph spec.** "User has mastered X" is the mastery predicate. The graph spec owns the definition. v1 assumes a boolean `isNodeMastered(userId, nodeId) -> boolean` exists; if the graph uses a threshold-based score, adapt this to `score >= MASTERY_THRESHOLD`.

**Diversify pool.** Items outside the current week's domain activity.

- Collect domains touched in the last 7 days.
- Candidates: cards + reps + unstarted nodes in domains NOT in that set, subject to the same cert / skip / prerequisites filters as the other pools.
- Score: `diversifyScore = (1 - domainFrequencyLast30Days)` -- the less often touched, the higher the score. Ties broken by priority.
- `reasonCode`: `diversify_unused_domain` | `diversify_cross_domain_apply`

#### Phase 3: Allocate slots

Compute slice counts from the mode's weights and the session_length, rounded to integers with the largest-remainder method to guarantee the sum equals session_length. If a slice pool is smaller than its allocation, redistribute the remainder across the other slices proportional to their weights (strengthen > continue > expand > diversify). If all pools combined have fewer than session_length items, return what we have and mark the session as "short" in the preview.

#### Phase 4: Within-slice selection

For each slice:

1. Filter candidates by focus_filter, cert_filter, skip_filter.
2. Sort by score descending.
3. Take top-N = slot allocation, with a deterministic seeded-random tiebreaker so Shuffle can produce different picks without rewriting the scoring rule.
4. Attach `reasonCode`, `reasonDetail`, and `slice`.

#### Phase 5: Interleave and order

Do not present all Continue first, then all Strengthen. Round-robin across slices in a deterministic order (Continue -> Strengthen -> Expand -> Diversify, repeat) so the experience varies across the session. Preview groups by slice; play order is interleaved.

### Mode weights

Modes are pre-defined weight tuples. Future work may expose these as user settings.

| Mode         | Continue | Strengthen | Expand | Diversify |
| ------------ | -------- | ---------- | ------ | --------- |
| `mixed`      | 0.30     | 0.30       | 0.20   | 0.20      |
| `continue`   | 0.70     | 0.20       | 0.00   | 0.10      |
| `strengthen` | 0.10     | 0.70       | 0.00   | 0.20      |
| `expand`     | 0.10     | 0.10       | 0.70   | 0.10      |

A "focused" session is not a separate weight tuple -- it's any mode with `focus_override` set. The user chose Weather, so every slice prefers Weather; the slice weights stay the same.

### Skip semantics

Three distinct actions, three distinct effects.

| Action          | Immediate effect                                 | Plan mutation                                                                                          | Downstream                                                                     |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Skip today      | Mark item completed with `skip_kind='today'`     | None                                                                                                   | Item excluded from this session's remaining loops; normal scheduling otherwise |
| Skip topic      | Same, `skip_kind='topic'`                        | Add node's domain to `skip_domains` OR add node to `skip_nodes` (node-level, once cards/reps link to a node_id) | Future sessions exclude that domain/node until user reactivates                |
| Skip permanent  | Same, `skip_kind='permanent'`                    | Add node ID to `skip_nodes`. For cards/reps not tied to a node: set card status='suspended' or scenario status='suspended' | The item never reappears. User can reactivate via browse page.                 |

For cards and reps, "skip topic" behavior depends on whether the card/rep has a `node_id`. Without `node_id`, "skip topic" adds the card/rep's `domain` to `skip_domains`. With `node_id`, it adds the node to `skip_nodes`.

> **Depends on knowledge-graph spec.** Cards and reps will gain a `node_id` field per ADR 011. Until then, "skip topic" acts at the domain level for cards/reps. Once the graph ships, update the skip-topic branch to prefer node-level skip when `node_id` is present.

### Session summary

After all items are resolved, the summary shows:

- Items attempted (resolved with a review/attempt).
- Items skipped, grouped by skip_kind.
- Correct count (cards rated Good/Easy, reps with `is_correct=true`).
- Avg pre-reveal confidence across the session.
- Domains touched.
- Nodes started (items with `kind='node_start'`).
- Streak: count of distinct calendar days with at least one attempted `session_item_result` in the user's local timezone.
- Suggested next: up to 3 hints computed from the just-finished state.

### Streak calculation

Streak is the count of consecutive local-calendar days (in the user's configured timezone, default `America/Denver`) ending today where the user attempted at least one session item. A day counts if `session_item_result.completed_at` falls within that local day AND the item was not skipped. If the user's timezone is unset, fall back to `UTC`. Streak is computed at summary time from `session_item_result` via a single aggregate query; not cached.

### Suggested next

Up to 3 non-binding hints shown on the session summary:

1. "N cards due tomorrow" -- count cards where `card_state.due_at` falls within the next 24 hours.
2. "Finish node X" -- the first `node_start` item in the just-finished session that has unfinished content phases, per graph content-phase flags. Hidden if the graph spec doesn't yet expose content-phase completion.
3. "Try a Strengthen session" -- shown if the user completed a Continue or Expand session AND has > 5 relearning cards or < 60% rep accuracy over the last 14 days.

> **Depends on knowledge-graph spec.** "Unfinished content phases" requires the graph to expose per-user phase completion. If the spec defers this, the hint is omitted from v1.

## BC Surface

All exports from `libs/bc/study/src/index.ts`. New files:

- `plans.ts` -- plan CRUD + active-plan resolution.
- `sessions.ts` -- session CRUD + preview regeneration + commit + item-result writes.
- `engine.ts` -- pure engine function + score functions + slot allocation. No DB writes; reads happen via injected query functions so the engine is unit-testable with fakes.
- `plans.test.ts`, `sessions.test.ts`, `engine.test.ts` -- unit coverage.

### Functions

| File          | Function            | Signature                                                                                     |
| ------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `plans.ts`    | `createPlan`        | `(db, data: CreatePlanInput) -> Plan`                                                         |
| `plans.ts`    | `updatePlan`        | `(db, planId, userId, data: UpdatePlanInput) -> Plan`                                         |
| `plans.ts`    | `getActivePlan`     | `(db, userId) -> Plan \| null`                                                                |
| `plans.ts`    | `archivePlan`       | `(db, planId, userId) -> void`                                                                |
| `plans.ts`    | `addSkipNode`       | `(db, planId, userId, nodeId) -> Plan`                                                        |
| `plans.ts`    | `addSkipDomain`     | `(db, planId, userId, domain) -> Plan`                                                        |
| `sessions.ts` | `previewSession`    | `(db, userId, opts: { mode?, focus?, cert?, seed? }) -> SessionPreview`                       |
| `sessions.ts` | `commitSession`     | `(db, userId, preview: SessionPreview) -> Session`                                            |
| `sessions.ts` | `recordItemResult`  | `(db, sessionId, slotIndex, result: ItemResultInput) -> SessionItemResult`                    |
| `sessions.ts` | `completeSession`   | `(db, sessionId, userId) -> SessionSummary`                                                   |
| `sessions.ts` | `getSessionSummary` | `(db, sessionId, userId) -> SessionSummary`                                                   |
| `sessions.ts` | `getStreakDays`     | `(db, userId, tz: string) -> number`                                                          |
| `engine.ts`   | `runEngine`         | `(inputs: EngineInputs) -> SessionItem[]` (pure)                                              |
| `engine.ts`   | `allocateSlots`     | `(weights: ModeWeights, length: number) -> Record<Slice, number>` (pure)                      |
| `engine.ts`   | `modeWeights`       | `(mode: SessionMode) -> ModeWeights` (pure)                                                   |

`EngineInputs` bundles the plan, effective filters, pool-query callbacks, mode, session_length, and seed. The engine never touches the DB directly.

### Read interfaces consumed

Existing reads stay unchanged; new reads added for pool assembly.

Existing:

- `getDueCards(db, userId, limit?)`
- `getRepAccuracy(db, userId, domain?)` (from decision-reps BC)
- `getReviewStats(db, userId, dateRange?)`

New (added here):

- `getCandidateCards(db, userId, filters) -> CardCandidate[]` -- lives in `cards.ts`. Filters: domains, cert, skip, due window.
- `getCandidateReps(db, userId, filters) -> RepCandidate[]` -- same pattern for scenarios.
- `getRecentSessionDomains(db, userId, sessionLookback=2) -> Domain[]` -- in `sessions.ts`.

> **Depends on knowledge-graph spec.** Graph-facing reads (`getCandidateNodes`, `isNodeMastered`, `getNodeMastery`, `getDomainMasteryTrend`) are not defined in this work package. They're consumed from whatever BC the graph spec lands in. Until then, the engine declares them as injected dependencies via `EngineInputs`; tasks.md calls out wiring them as a distinct step after the graph BC exists.

## Routes

All routes go through `ROUTES` in `libs/constants/src/routes.ts`. Static routes are string constants; parameterized routes are typed functions.

| Route            | Purpose                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| `/plans`         | List plans (v1 shows the single active plan; forward-compatible with multi-plan).    |
| `/plans/new`     | First-run wizard / create new plan.                                                  |
| `/plans/:id`     | View + edit a plan.                                                                  |
| `/session/start` | Preview + adjust + commit. Query params: `mode`, `focus`, `cert`, `seed`.            |
| `/sessions`      | History of past sessions (list; date, mode, items attempted, accuracy).              |
| `/sessions/:id`  | In-progress session presentation; on completion, the summary view.                   |

Route constants to add:

```typescript
PLANS: '/plans',
PLANS_NEW: '/plans/new',
PLAN: (id: string) => `/plans/${id}` as const,
SESSION_START: '/session/start',
SESSIONS: '/sessions',
SESSION: (id: string) => `/sessions/${id}` as const,
```

`/session/start` (singular) is the pre-start launcher; `/sessions/:id` (plural) is the in-progress-or-complete session.

## Validation

| Field                            | Rule                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| plan.title                       | Required, 1-200 chars, trimmed                                                                |
| plan.cert_goals                  | Array of `Cert` values, 1-4 entries, each from `CERTS`                                        |
| plan.focus_domains               | Array of domain slugs, 0-5 entries, each from `DOMAINS`, disjoint from skip_domains           |
| plan.skip_domains                | Array of domain slugs, 0-14 entries, each from `DOMAINS`                                      |
| plan.skip_nodes                  | Array of strings (node IDs), 0-200 entries, each 1-100 chars                                  |
| plan.session_length              | Integer, 3-50                                                                                 |
| plan.default_mode                | Required, from `SESSION_MODES`                                                                |
| plan.depth_preference            | Required, from `DEPTH_PREFERENCES`                                                            |
| session.mode                     | Required, from `SESSION_MODES`                                                                |
| session.focus_override           | Optional, from `DOMAINS`                                                                      |
| session.cert_override            | Optional, from `CERTS`                                                                        |
| session.items                    | Non-empty array of valid `SessionItem`, length <= 50                                          |
| session_item_result.item_kind    | From `SESSION_ITEM_KINDS`                                                                     |
| session_item_result.slice        | From `SESSION_SLICES`                                                                         |
| session_item_result.skip_kind    | NULL or from `SESSION_SKIP_KINDS`                                                             |

One-active-plan invariant is enforced by a Postgres partial UNIQUE index: `CREATE UNIQUE INDEX plan_user_active_uniq ON study.study_plan (user_id) WHERE status = 'active';`. Activating a plan must archive any other active plan for the user in the same transaction.

## Constants

New constants added to `libs/constants/src/study.ts`:

- `CERTS = { PPL, IR, CPL, CFI }` + labels + values array.
- `PLAN_STATUSES = { DRAFT, ACTIVE, ARCHIVED }`.
- `SESSION_MODES = { CONTINUE, STRENGTHEN, MIXED, EXPAND }` + labels.
- `SESSION_SLICES = { CONTINUE, STRENGTHEN, EXPAND, DIVERSIFY }` + labels.
- `SESSION_ITEM_KINDS = { CARD, REP, NODE_START }`.
- `SESSION_SKIP_KINDS = { TODAY, TOPIC, PERMANENT }`.
- `SESSION_REASON_CODES` -- the full enum of reason codes listed in the engine section + labels.
- `DEPTH_PREFERENCES = { SURFACE, WORKING, DEEP }`.
- `MODE_WEIGHTS` -- the weight tuples from the table above.
- `DEFAULT_SESSION_LENGTH = 10`, `MIN_SESSION_LENGTH = 3`, `MAX_SESSION_LENGTH = 50`.
- `RESUME_WINDOW_MS = 2 * 60 * 60 * 1000`.
- `MASTERY_THRESHOLD` (provisional 0.7) -- flagged for graph spec alignment.

Value arrays (`CERT_VALUES`, `PLAN_STATUS_VALUES`, etc.) follow the existing pattern for DB CHECK constraints.

## Edge Cases

- **User has no plan.** `/session/start` shows a "set up your plan" card linking to `/plans/new`. Engine is not invoked.
- **User has an active plan but no cards, reps, or nodes yet.** Preview shows 0 items with "Nothing to study yet -- create cards, or wait for the knowledge graph" message. Streak is unchanged.
- **All pools empty for a slice.** Remainder redistributes. If all slices are empty, the preview shows 0 items with the same message as above.
- **Pool smaller than allocation.** Take all, redistribute the leftover quota to other slices proportional to weight.
- **Duplicate candidate across slices.** An item can be Continue AND Strengthen. First pass picks it for the higher-scoring slice; later passes exclude it. No duplicates across slices in a single batch.
- **Session preview called twice before commit.** Each call returns a fresh ordering seeded from the opts. No persistence until commit. `seed` is user-overridable via Shuffle.
- **Session commit race.** If two commits arrive with the same plan_id within 1 second, accept the first, reject the second with "session already in progress". The one-in-progress constraint is advisory only -- the user can start another session if the first was abandoned beyond the resume window.
- **Skipping the last item.** Completes the session and transitions to summary; skipped items count in the skipped tally, not the attempted tally.
- **Timezone edge cases for streak.** User in UTC-7 reviews at 2355 local (0655 UTC next day). Streak must count that review as "today" (local), not "tomorrow" (UTC). All streak math runs in the user's configured tz.
- **Shuffle produces identical items.** Possible with small pools. The UI shows "No other items to pick from" when Shuffle yields an identical or insufficiently-different batch (>= 80% overlap).
- **Replace-an-item after commit.** Not supported. Once committed, items are fixed. Mid-session, only Skip mutates the experience.
- **Plan edits mid-session.** Saved plan edits do not retroactively change an in-progress session's items. The session's `items` jsonb is the authoritative batch once committed.
- **Item's underlying card deleted mid-session.** Skip with `skip_kind` NULL and a synthesized `reason_detail='source deleted'`; surface a one-line notice in the summary.

## Out of Scope for v1

- Multiple active plans per user.
- Plan sharing or templates across users.
- ML-based weight tuning or any learned models.
- Custom mode weight tuples exposed as user settings.
- Cross-surface sessions (audio drill, spatial route walkthrough as session items).
- Calendar-like projected load views.
- Goal deadlines (BFR Sprint / IPC Sprint countdowns).
- Natural-language focus parsing ("study holding patterns" -> engine matches).
- Paired-session suggestions (run a card session, then suggest a rep session in the same domain).
- Activity items (interactive visualizations as session items -- extend `SessionItem` later).
- Mid-session replace of an already-committed item.
- Session resume beyond 2 hours.
- Mood-aware mode suggestions.
- Anki-style scheduler replacement -- we schedule sessions, not individual cards; SRS scheduling stays in Memory Items.

## Open Questions

1. **Mastery predicate for Expand prerequisites.** Boolean (mastered/not) or threshold score? Provisional `MASTERY_THRESHOLD = 0.7`. Reconcile with knowledge-graph spec.
2. **Session resume window.** 2 hours is a guess. Longer might frustrate with stale items; shorter might lose data. Observe in real use.
3. **Shuffle diff guarantee.** Should Shuffle guarantee a minimum diff from the prior batch? Currently no -- deterministic with a new seed. If the pool is small this can feel like a no-op.
4. **Session-level "undo".** User misclicks "skip permanently" -- is there an undo path on the summary page? Proposed: yes, within the same session; beyond that, browse-page reactivation.
5. **First-run default plan.** Create a conservative default (PPL-only, working depth, 10-item, mixed) if the user skips the wizard? Or require explicit input? Proposed: require input; the wizard is short.
6. **Explicit "end session" action.** In the preview, yes. Mid-session, is there a "stop now" that transitions to summary with partial completion? Proposed: yes, called "Finish early".
7. **Engine determinism across DB changes.** If a card state changes between Phase 1 and Phase 4 of a single engine run, the batch could include a card that just became un-due. Acceptable in v1; the commit snapshot locks it.

## References

- [Study Plan + Session Engine PRD](./PRD.md)
- [Knowledge Graph PRD](../knowledge-graph/PRD.md)
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [Spaced Memory Items spec](../spaced-memory-items/spec.md)
- [Decision Reps spec](../decision-reps/spec.md)
- [DESIGN_PRINCIPLES](../../platform/DESIGN_PRINCIPLES.md)
- [VOCABULARY](../../platform/VOCABULARY.md)
