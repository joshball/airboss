---
title: 'Design: Study Plan + Session Engine'
product: study
feature: study-plan-and-session-engine
type: design
status: unread
review_status: pending
---

# Design: Study Plan + Session Engine

## Plan and Session as distinct aggregates

**Question:** One table for "study state" or two for plan and session?

**Chosen:** Two. `study.study_plan` is the slow-moving configuration (edited weekly). `study.session` is the high-volume event log (every study run). Merging them would make plans immutable (bad UX -- users want to edit cert goals in place) or sessions unversioned (bad audit -- we want to see what plan was active when the user ran Session X on Tuesday).

Session carries `plan_id` so we can reconstruct the plan state at session time if needed, and so analytics can segment by plan. We don't snapshot the full plan on the session row; if a plan is edited, historical sessions keep their foreign key and accept the live plan as the best-available reference. This matches the spec's v1 stance that plans are mutable configurations, not audit records.

## Engine as a pure function

**Question:** Where does the engine code live, and how is it tested?

**Chosen:** A pure function in `libs/bc/study/src/engine.ts`. Takes `EngineInputs` (plan, mode, weights, seed, plus injected query callbacks) and returns `SessionItem[]`. No DB access in the engine file. The `sessions.ts` file orchestrates: it loads the plan, builds query callbacks over Drizzle, calls `runEngine`, persists the commit.

**Why:**

- The engine has five phases and four scoring rules. Pure-function testing is the only sane way to cover the matrix (weights x pool sizes x filter combinations x tiebreakers).
- Injecting pool-query callbacks means the graph-facing reads (`getCandidateNodes`, `isNodeMastered`) can be stubbed while the knowledge-graph BC is being built in parallel. This work package's engine can ship without waiting for the graph BC to land.
- A pure engine is deterministic given a seed. That's what makes Shuffle work correctly and makes regressions catchable.
- If a future ML path is explored (well beyond v1), it plugs in behind the same `EngineInputs` surface -- the function signature doesn't change, only the internals.

**Cost accepted:** An extra layer of indirection. The pool-query callbacks are a small interface (5-6 functions). Worth the testability.

## Rule-based, not learned

**Question:** Why not a lightweight learned model (logistic regression, bandits)?

**Chosen:** Explicit weighted slices with explicit scoring rules, exposed in constants.

**Why:**

- Joshua is user zero. One user = no training data.
- The reasoning labels (shown next to each item in the preview) require the system to explain WHY each item was picked. A learned model makes "why" noisy or inscrutable.
- The 30/30/20/20 split is a principled allocation from the PRD, not a tuning target. It reflects a belief about how study time should be spent (continuity + strengthen weighted equally above expand and diversify). That belief is falsifiable with observation, but it's not something to learn from n=1.
- Rule-based scoring is debuggable. If a bad pick appears, we trace the score and fix the rule.

**When to revisit:** At 100+ users with real telemetry, a learned re-ranker on top of the rule-based slicer is a sensible v2. The pure-function engine design makes this swap low-cost.

## Slice allocation uses largest-remainder rounding

**Question:** How do float weights times session_length become integer slot counts?

**Chosen:** Largest-remainder method. Multiply each weight by session_length, take the integer floor for each slice, then distribute the remainder slots one at a time to whichever slice has the largest fractional residual (ties broken by a fixed slice priority: strengthen > continue > expand > diversify).

**Why:**

- Simple integer rounding (`Math.round`) doesn't sum to the target length in every mode x length combination.
- Largest-remainder is the same algorithm used in parliamentary seat allocation. It's unbiased and obviously correct in a comment.
- Fixed tiebreaker ordering makes the result deterministic for testing.

Example: `mixed` (0.30/0.30/0.20/0.20) x session_length 10 -> slots 3/3/2/2. Clean. `mixed` x session_length 7 -> raw 2.1/2.1/1.4/1.4 -> floors 2/2/1/1 = 6, remainder 1 goes to strengthen (largest residual after tiebreaker) -> 2/3/1/1. Also clean and deterministic.

## Pool redistribution when a slice is short

**Question:** A slice has 2 candidates but got allocated 3 slots. Now what?

**Chosen:** Take all available, redistribute the leftover quota to the other slices proportional to their weights (strengthen > continue > expand > diversify). If all pools combined still can't fill session_length, return a short session with a preview marker.

**Why:**

- Returning empty slots would make the preview feel broken ("why are there 8 items instead of 10?").
- Refusing to run the engine is worse -- the user asked to study.
- Proportional redistribution preserves the mode's intent: a `strengthen` mode that runs out of strengthen candidates should fill the gap with its next-largest slice (diversify at 0.20), not randomly.
- A "short session" marker teaches the user something true ("you've run out of weak spots -- try Expand?") and drives the Suggested next hint.

## Reason codes are enums, reasonDetail is prose

**Question:** Should the UI label be free text or structured?

**Chosen:** Both. `reasonCode` is a closed enum in `SESSION_REASON_CODES` (used for grouping, analytics, testing). `reasonDetail` is an optional free-text string the engine may fill in with specifics ("rated Again yesterday", "prerequisites met: VFR minimums, visibility + ceiling definitions").

**Why:**

- Pure free text can't be analyzed -- "what % of picks were due-today vs overdue?" requires an enum.
- Pure enums can't express "you rated Again YESTERDAY specifically" -- that's what makes the preview feel explained rather than labeled.
- Both combined give us analytics AND a good user experience.

## Skip's three-way split

**Question:** Skip today / skip topic / skip permanent -- should they collapse into one?

**Chosen:** Keep them distinct. Each has a different downstream effect, and the PRD calls this out explicitly as a "UX trap" if conflated.

- **Skip today** is session-scoped. Mutates nothing beyond the session_item_result.
- **Skip topic** mutates the plan (adds a domain or a node).
- **Skip permanent** mutates the plan AND suspends the underlying card/scenario if no node_id is attached.

**Why three actions and not two:**

- A user wanting to skip a single hard card "for now" (today) is different from a user deciding "this topic is not for me this month" (topic). Same gesture, different intent.
- "Topic" cannot be folded into "permanent" because topic is per-topic temporary exclusion, not per-item permanent suspension. Re-enabling a topic is an edit on the plan; re-enabling a suspended card is a card-detail action.
- The three actions collapse to a single mid-session dropdown with three options, so UI cost is minimal.

## Session items are a jsonb snapshot, not a join table

**Question:** Store session items as `study.session_item` rows or as jsonb on the session row?

**Chosen:** jsonb on `study.session.items`, plus a separate `study.session_item_result` table for outcomes.

**Why:**

- The item batch is committed as an ordered, immutable whole. We never query "find all sessions containing card X" -- that's what `session_item_result` is for (which joins cleanly through `card_id`).
- Separating items (plan) from item_results (outcomes) reflects the real semantics: the plan is a single committed decision, results are a stream of events against it.
- jsonb on the session row avoids an N-row insert at commit time. Single insert, single transaction.
- If we needed relational queries against items later, we can denormalize to a table without changing the write path (the jsonb stays authoritative; table is a projection).

**Cost accepted:** Can't easily `SELECT items.cardId FROM ... WHERE items @> ...` with Drizzle's typed query builder. Raw SQL or jsonb path operators are available when needed.

## One-active-plan invariant via partial UNIQUE index

**Question:** How do we guarantee at most one active plan per user?

**Chosen:** Postgres partial UNIQUE index: `CREATE UNIQUE INDEX plan_user_active_uniq ON study.study_plan (user_id) WHERE status = 'active';`.

**Why:**

- Application-layer checks race. A double-click on "activate" could produce two active plans without a DB constraint.
- Partial UNIQUE is the exact primitive for "this column must be unique when another column has a specific value". Costs nothing vs a full UNIQUE on (user_id, status), which would incorrectly forbid multiple archived plans.
- Activating a plan must happen in a transaction that first archives any other active plan for the user. The partial index guards the invariant even if the transaction logic is wrong.

## Streak is computed, not cached

**Question:** Cache streak on a user_streak row, or compute on demand?

**Chosen:** Compute on demand from `study.session_item_result` at summary time.

**Why:**

- Streak math requires the user's timezone. Caching introduces tz-change bugs (user flies to a different tz, streak rolls at the wrong moment).
- A single aggregate query over a user's recent session_item_result rows is fast enough -- this is a read, not a hot path. We can add an index (`user_id, completed_at`) if it becomes a concern.
- Caching adds a drift source (cache desync with the truth). At MVP scale, avoid the class of bug.

## Schema shape

Drizzle ORM, `study` Postgres namespace. Appends to the existing `libs/bc/study/src/schema.ts`.

```typescript
// libs/bc/study/src/schema.ts (new additions)

export const studyPlan = studySchema.table(
	'study_plan',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => bauthUser.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		status: text('status').notNull().default(PLAN_STATUSES.ACTIVE),
		certGoals: jsonb('cert_goals').$type<Cert[]>().notNull().default([]),
		focusDomains: jsonb('focus_domains').$type<Domain[]>().notNull().default([]),
		skipDomains: jsonb('skip_domains').$type<Domain[]>().notNull().default([]),
		skipNodes: jsonb('skip_nodes').$type<string[]>().notNull().default([]),
		depthPreference: text('depth_preference').notNull().default(DEPTH_PREFERENCES.WORKING),
		sessionLength: smallint('session_length').notNull().default(DEFAULT_SESSION_LENGTH),
		defaultMode: text('default_mode').notNull().default(SESSION_MODES.MIXED),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		planUserStatusIdx: index('plan_user_status_idx').on(t.userId, t.status),
		// Enforced as a raw partial-UNIQUE in a migration hand-written next to the push.
		statusCheck: check('plan_status_check', sql.raw(`"status" IN (${inList(PLAN_STATUS_VALUES)})`)),
		depthCheck: check('plan_depth_check', sql.raw(`"depth_preference" IN (${inList(DEPTH_PREFERENCE_VALUES)})`)),
		modeCheck: check('plan_mode_check', sql.raw(`"default_mode" IN (${inList(SESSION_MODE_VALUES)})`)),
		sessionLengthCheck: check('plan_session_length_check', sql`"session_length" BETWEEN 3 AND 50`),
	}),
);

export const session = studySchema.table(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),
		planId: text('plan_id').notNull().references(() => studyPlan.id, { onDelete: 'restrict' }),
		mode: text('mode').notNull(),
		focusOverride: text('focus_override'),
		certOverride: text('cert_override'),
		sessionLength: smallint('session_length').notNull(),
		items: jsonb('items').$type<SessionItem[]>().notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
	},
	(t) => ({
		sessionUserStartedIdx: index('session_user_started_idx').on(t.userId, t.startedAt),
		sessionPlanStartedIdx: index('session_plan_started_idx').on(t.planId, t.startedAt),
		modeCheck: check('session_mode_check', sql.raw(`"mode" IN (${inList(SESSION_MODE_VALUES)})`)),
	}),
);

export const sessionItemResult = studySchema.table(
	'session_item_result',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id').notNull().references(() => session.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		slotIndex: smallint('slot_index').notNull(),
		itemKind: text('item_kind').notNull(),
		slice: text('slice').notNull(),
		reasonCode: text('reason_code').notNull(),
		cardId: text('card_id').references(() => card.id, { onDelete: 'set null' }),
		scenarioId: text('scenario_id').references(() => scenario.id, { onDelete: 'set null' }),
		nodeId: text('node_id'),
		reviewId: text('review_id').references(() => review.id, { onDelete: 'set null' }),
		repAttemptId: text('rep_attempt_id').references(() => repAttempt.id, { onDelete: 'set null' }),
		skipKind: text('skip_kind'),
		presentedAt: timestamp('presented_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
	},
	(t) => ({
		sirSessionSlotIdx: index('sir_session_slot_idx').on(t.sessionId, t.slotIndex),
		sirUserCompletedIdx: index('sir_user_completed_idx').on(t.userId, t.completedAt),
		itemKindCheck: check('sir_item_kind_check', sql.raw(`"item_kind" IN (${inList(SESSION_ITEM_KIND_VALUES)})`)),
		sliceCheck: check('sir_slice_check', sql.raw(`"slice" IN (${inList(SESSION_SLICE_VALUES)})`)),
		skipKindCheck: check(
			'sir_skip_kind_check',
			sql.raw(`"skip_kind" IS NULL OR "skip_kind" IN (${inList(SESSION_SKIP_KIND_VALUES)})`),
		),
	}),
);
```

The partial UNIQUE index for the one-active-plan invariant is emitted via a hand-written migration alongside the `drizzle-kit push`, because Drizzle's table DSL doesn't currently express partial UNIQUE indexes cleanly. Tasks.md calls this out explicitly.

## Constants additions

```typescript
// libs/constants/src/study.ts (new additions)

export const CERTS = {
	PPL: 'PPL',
	IR: 'IR',
	CPL: 'CPL',
	CFI: 'CFI',
} as const;

export type Cert = (typeof CERTS)[keyof typeof CERTS];
export const CERT_VALUES = Object.values(CERTS);
export const CERT_LABELS: Record<Cert, string> = {
	PPL: 'Private Pilot',
	IR: 'Instrument Rating',
	CPL: 'Commercial Pilot',
	CFI: 'Flight Instructor',
};

export const PLAN_STATUSES = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	ARCHIVED: 'archived',
} as const;

export type PlanStatus = (typeof PLAN_STATUSES)[keyof typeof PLAN_STATUSES];
export const PLAN_STATUS_VALUES = Object.values(PLAN_STATUSES);

export const SESSION_MODES = {
	CONTINUE: 'continue',
	STRENGTHEN: 'strengthen',
	MIXED: 'mixed',
	EXPAND: 'expand',
} as const;

export type SessionMode = (typeof SESSION_MODES)[keyof typeof SESSION_MODES];
export const SESSION_MODE_VALUES = Object.values(SESSION_MODES);

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
	continue: 'Continue where I left off',
	strengthen: 'Hit my weak spots',
	mixed: 'Mixed (default)',
	expand: 'Try something new',
};

export const SESSION_SLICES = {
	CONTINUE: 'continue',
	STRENGTHEN: 'strengthen',
	EXPAND: 'expand',
	DIVERSIFY: 'diversify',
} as const;

export type SessionSlice = (typeof SESSION_SLICES)[keyof typeof SESSION_SLICES];
export const SESSION_SLICE_VALUES = Object.values(SESSION_SLICES);

export const SESSION_ITEM_KINDS = {
	CARD: 'card',
	REP: 'rep',
	NODE_START: 'node_start',
} as const;

export type SessionItemKind = (typeof SESSION_ITEM_KINDS)[keyof typeof SESSION_ITEM_KINDS];
export const SESSION_ITEM_KIND_VALUES = Object.values(SESSION_ITEM_KINDS);

export const SESSION_SKIP_KINDS = {
	TODAY: 'today',
	TOPIC: 'topic',
	PERMANENT: 'permanent',
} as const;

export type SessionSkipKind = (typeof SESSION_SKIP_KINDS)[keyof typeof SESSION_SKIP_KINDS];
export const SESSION_SKIP_KIND_VALUES = Object.values(SESSION_SKIP_KINDS);

export const DEPTH_PREFERENCES = {
	SURFACE: 'surface',
	WORKING: 'working',
	DEEP: 'deep',
} as const;

export type DepthPreference = (typeof DEPTH_PREFERENCES)[keyof typeof DEPTH_PREFERENCES];
export const DEPTH_PREFERENCE_VALUES = Object.values(DEPTH_PREFERENCES);

export const SESSION_REASON_CODES = {
	CONTINUE_RECENT_DOMAIN: 'continue_recent_domain',
	CONTINUE_DUE_IN_DOMAIN: 'continue_due_in_domain',
	CONTINUE_UNFINISHED_NODE: 'continue_unfinished_node',
	STRENGTHEN_RELEARNING: 'strengthen_relearning',
	STRENGTHEN_RATED_AGAIN: 'strengthen_rated_again',
	STRENGTHEN_OVERDUE: 'strengthen_overdue',
	STRENGTHEN_LOW_REP_ACCURACY: 'strengthen_low_rep_accuracy',
	STRENGTHEN_MASTERY_DROP: 'strengthen_mastery_drop',
	EXPAND_UNSTARTED_READY: 'expand_unstarted_ready',
	EXPAND_UNSTARTED_PRIORITY: 'expand_unstarted_priority',
	EXPAND_FOCUS_MATCH: 'expand_focus_match',
	DIVERSIFY_UNUSED_DOMAIN: 'diversify_unused_domain',
	DIVERSIFY_CROSS_DOMAIN_APPLY: 'diversify_cross_domain_apply',
} as const;

export type SessionReasonCode = (typeof SESSION_REASON_CODES)[keyof typeof SESSION_REASON_CODES];
export const SESSION_REASON_CODE_VALUES = Object.values(SESSION_REASON_CODES);

export const MODE_WEIGHTS: Record<SessionMode, Record<SessionSlice, number>> = {
	mixed:      { continue: 0.30, strengthen: 0.30, expand: 0.20, diversify: 0.20 },
	continue:   { continue: 0.70, strengthen: 0.20, expand: 0.00, diversify: 0.10 },
	strengthen: { continue: 0.10, strengthen: 0.70, expand: 0.00, diversify: 0.20 },
	expand:     { continue: 0.10, strengthen: 0.10, expand: 0.70, diversify: 0.10 },
};

export const DEFAULT_SESSION_LENGTH = 10;
export const MIN_SESSION_LENGTH = 3;
export const MAX_SESSION_LENGTH = 50;
export const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;
// No mastery threshold -- study-plan does not own the mastery formula.
// See libs/bc/study/src/knowledge.ts#isNodeMastered (dual-gate boolean).
```

## API Surface

### Server load functions

| Route                             | Load                                                     | Returns                                                                                  |
| --------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `(app)/plans/+page.server.ts`     | `getActivePlan(userId)` + list of archived plans         | Active plan plus archived list                                                           |
| `(app)/plans/new/+page.server.ts` | --                                                       | `DOMAINS`, `CERTS`, `SESSION_MODES`, `DEPTH_PREFERENCES` for the wizard form             |
| `(app)/plans/[id]/+page.server.ts`| `getPlan(planId, userId)`                                | Plan detail                                                                              |
| `(app)/session/start/+page.server.ts` | `previewSession(userId, opts)` + plan                | `SessionPreview` (items + reasoning groups) and the plan                                 |
| `(app)/sessions/+page.server.ts`  | `getSessionHistory(userId, limit: 50)`                   | Paginated session list                                                                   |
| `(app)/sessions/[id]/+page.server.ts` | `getSession(sessionId, userId)` + `getSessionSummary` if complete | Session + in-progress cursor or summary                                   |

### Form actions

| Route                                  | Action         | What it does                                                    |
| -------------------------------------- | -------------- | --------------------------------------------------------------- |
| `(app)/plans/new/+page.server.ts`      | `default`      | Validate + create plan, activate                                |
| `(app)/plans/[id]/+page.server.ts`     | `update`       | Validate + update plan                                          |
| `(app)/plans/[id]/+page.server.ts`     | `archive`      | Archive plan                                                    |
| `(app)/plans/[id]/+page.server.ts`     | `activate`     | Activate (archives other active plans in-txn)                   |
| `(app)/session/start/+page.server.ts`  | `shuffle`      | Re-run engine with new seed                                     |
| `(app)/session/start/+page.server.ts`  | `replaceItem`  | Re-run engine for a single slot                                 |
| `(app)/session/start/+page.server.ts`  | `commit`       | `commitSession` -- writes session row and redirects to `/sessions/:id` |
| `(app)/sessions/[id]/+page.server.ts`  | `recordResult` | `recordItemResult` -- updates session_item_result for a slot    |
| `(app)/sessions/[id]/+page.server.ts`  | `skip`         | Record skip with kind; mutate plan if topic/permanent           |
| `(app)/sessions/[id]/+page.server.ts`  | `finishEarly`  | Transition to summary with partial completion                   |
| `(app)/sessions/[id]/+page.server.ts`  | `complete`     | `completeSession` -- finalize summary                           |

## Data Flow

```text
Plan creation:
  wizard submit -> action validates -> plans.createPlan() -> INSERT study_plan (status=active)
  -> redirect to /plans/:id

Session preview:
  /session/start load -> getActivePlan() -> previewSession(userId, { mode, focus, cert, seed })
  previewSession():
    1. Resolve filters from plan + overrides
    2. Build pool-query callbacks over Drizzle
    3. runEngine(inputs) -- pure function
    4. Return SessionPreview { items, reasoningGroups, short?, seed }
  (no persistence yet)

Session commit:
  user clicks Start -> action commit -> commitSession()
    1. Guard: no in-progress session for same plan in last 2h
    2. INSERT study.session with items snapshot, mode, overrides
    3. Redirect to /sessions/:id

Item attempt:
  user rates card -> existing Memory review flow runs -> writes study.review
  -> session page invokes recordItemResult(sessionId, slotIndex, { reviewId })
  -> INSERT session_item_result linking the two

Session complete:
  all items resolved -> completeSession() -> UPDATE study.session SET completed_at = now()
  -> build SessionSummary (attempted, correct, streak, suggestedNext)
```

## Key Decisions (summary)

- **Two aggregates, not one.** Plan = slow-moving config. Session = event log.
- **Engine is pure.** No DB in `engine.ts`. Inject pool callbacks.
- **Rule-based, not learned.** Explicit weights, explicit scoring rules, debuggable reasoning.
- **Largest-remainder for slot allocation.** Sums to session_length, deterministic, obvious.
- **Skip is three actions.** Today, topic, permanent -- each with different downstream effect.
- **SessionItem is jsonb.** Items are an immutable batch; results are a separate table.
- **One-active-plan via partial UNIQUE index.** DB-level invariant, not app-level guard.
- **Streak is computed.** Not cached; tz-correct at read time.
- **Graph-facing reads are injected.** Engine doesn't know about the graph BC; it calls callbacks. Swap in real graph reads once that spec lands.

## Alternatives considered

- **Session without commit step.** Rejected. Preview would have to persist, then the adjust flow would be a mutation on the persisted row. More complex than a pure preview + single commit.
- **Slice weights as per-plan settings in v1.** Rejected. Adds a settings surface before we know if the defaults need tuning. Defer.
- **Card scheduling changes to account for sessions.** Rejected. Sessions consume the existing SRS schedule; they don't modify it. Keeps Memory Items' behavior pure.
- **Graph-integrated from day one.** Accepted in spirit, deferred in code. The engine file exposes injection points for graph reads and ships with stubs that return empty candidate lists for node-based pools. The Expand slice is the affected slice; in the absence of graph reads, its allocation redistributes to Continue/Strengthen/Diversify. Observable in tests.
- **Node_id as a FK constraint.** Deferred. Until the graph's node table exists, `node_id` is plain text with app-layer validation. Flagged for reconciliation.
