---
title: 'Design: Decision Reps'
product: study
feature: decision-reps
type: design
status: unread
---

# Design: Decision Reps

## Decision Reps don't use the tick engine

**Question:** Should decision reps use `libs/engine/` (the scenario tick engine)?

**Answer:** No. The tick engine is for multi-step interactive simulations with student behavior models, real-time progression, and intervention ladders. Decision Reps are single-decision micro-scenarios: read situation, choose, see outcome. No tick loop, no student model, no real-time state. Just a `study.scenario` table with options + outcomes.

If decision reps ever evolve into multi-step scenarios, they graduate to the sim app and the tick engine. The study app stays simple.

## Schema additions

Extends the `study` schema from Spaced Memory Items.

```typescript
// Added to libs/bc/study/src/schema.ts

export const scenario = studySchema.table('scenario', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	title: text('title').notNull(),
	situation: text('situation').notNull(),
	options: jsonb('options').notNull(),
	teachingPoint: text('teaching_point').notNull(),
	domain: text('domain').notNull(),
	difficulty: text('difficulty').notNull(),
	phaseOfFlight: text('phase_of_flight'),
	sourceType: text('source_type').notNull().default('personal'),
	sourceRef: text('source_ref'),
	isEditable: boolean('is_editable').notNull().default(true),
	regReferences: jsonb('reg_references').default([]),
	status: text('status').notNull().default('active'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repAttempt = studySchema.table('rep_attempt', {
	id: text('id').primaryKey(),
	scenarioId: text('scenario_id').notNull().references(() => scenario.id),
	userId: text('user_id').notNull(),
	chosenOption: text('chosen_option').notNull(),
	isCorrect: boolean('is_correct').notNull(),
	confidence: smallint('confidence'),
	answerMs: integer('answer_ms'),
	attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
});
```

## Constants additions

```typescript
// Added to libs/constants/src/study.ts

export const DIFFICULTIES = {
	BEGINNER: 'beginner',
	INTERMEDIATE: 'intermediate',
	ADVANCED: 'advanced',
} as const;

export type Difficulty = (typeof DIFFICULTIES)[keyof typeof DIFFICULTIES];

export const PHASES_OF_FLIGHT = {
	PREFLIGHT: 'preflight',
	TAKEOFF: 'takeoff',
	CLIMB: 'climb',
	CRUISE: 'cruise',
	DESCENT: 'descent',
	APPROACH: 'approach',
	LANDING: 'landing',
	GROUND: 'ground',
} as const;

export type PhaseOfFlight = (typeof PHASES_OF_FLIGHT)[keyof typeof PHASES_OF_FLIGHT];
```

## API Surface

### Server load functions

| Route | Load | Returns |
| --- | --- | --- |
| `(app)/reps/+page.server.ts` | `getRepDashboard(userId)` | scenario count by domain, attempts today, accuracy |
| `(app)/reps/session/+page.server.ts` | `getNextScenarios(userId, filters, limit: 10)` | batch of scenarios prioritized by unattempted then least-recent |
| `(app)/reps/browse/+page.server.ts` | `getScenarios(userId, filters)` | paginated scenarios with filters |
| `(app)/reps/new/+page.server.ts` | -- | Needs DOMAINS, DIFFICULTIES, PHASES_OF_FLIGHT |

### Form actions

| Route | Action | What it does |
| --- | --- | --- |
| `(app)/reps/new/+page.server.ts` | `default` | Validate + create scenario |
| `(app)/reps/session/+page.server.ts` | `submitAttempt` | Record rep_attempt |

### BC functions

| File | Function | Signature |
| --- | --- | --- |
| `scenarios.ts` | `createScenario` | `(db, data: NewScenario) -> Scenario` |
| `scenarios.ts` | `getScenarios` | `(db, userId, filters?) -> Scenario[]` |
| `scenarios.ts` | `getNextScenarios` | `(db, userId, filters?, limit?) -> Scenario[]` |
| `scenarios.ts` | `submitAttempt` | `(db, scenarioId, userId, chosenOption, confidence?) -> RepAttempt` |
| `scenarios.ts` | `getRepAccuracy` | `(db, userId, domain?) -> AccuracyStats` |
| `scenarios.ts` | `getRepStats` | `(db, userId, dateRange?) -> RepStats` |

## Key Decisions

### Options stored as JSONB, not a separate table

Options are tightly coupled to the scenario -- they're always loaded together, never queried independently, and there's no scenario with more than 5. JSONB on the scenario row is simpler than a `study.scenario_option` join table. The tradeoff is you can't query "all scenarios where option X mentions icing" without a JSON path query, but that's not a use case we need.

### No scenario_state table (unlike card_state)

Cards need a materialized state table because FSRS tracks per-card values (stability, difficulty) that change on every review. Scenarios don't have SRS scheduling -- they're just attempted and recorded. "Which scenarios to show next" is a simple query on `rep_attempt` (unattempted first, then least-recently attempted). No materialized state needed.

### Same source model as cards

`source_type` + `source_ref` + `is_editable` on scenarios enables the same future integration: courses can assign scenarios, products can generate them, bulk import works. Same pattern, same constants, same behavior.
