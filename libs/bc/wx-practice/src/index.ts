// Wx-practice BC -- runtime / client-safe barrel.
//
// This barrel is reachable from `.svelte` files. Every value export here
// resolves to a module that does NOT statically import `@ab/db/connection`
// (which loads the postgres driver and crashes browser hydration with
// `ReferenceError: Buffer is not defined`).
//
// Server-only value exports (DB queries) live in `./server.ts`, exposed
// at `@ab/bc-wx-practice/server`. Drizzle table objects + row types are
// safe in the runtime barrel (Drizzle's pg-core is pure metadata; the
// connection import is what drags postgres in). Type re-exports erase at
// compile time.

// ---- Schema (browser-safe: Drizzle table metadata, no connection) ----
export {
	type WxPracticeAttemptInsert,
	type WxPracticeAttemptRow,
	type WxPracticeMasteryInsert,
	type WxPracticeMasteryRow,
	type WxPracticeSessionInsert,
	type WxPracticeSessionRow,
	wxPracticeAttempt,
	wxPracticeMastery,
	wxPracticeSchema,
	wxPracticeSession,
} from './schema';

// ---- State machine (pure) ----
export {
	type ApplyAttemptInput,
	type ApplyAttemptResult,
	applyAttempt,
	type MasterySnapshot,
	type MasteryTransition,
} from './state-machine';

// ---- Sampler (pure) ----
export {
	type DrillToken,
	masteryKey,
	type SampledItem,
	sampleSession,
	type SamplerInput,
} from './sampler';

// ---- Grader (pure) ----
export {
	defaultQuestionForm,
	gradeAttempt,
	type GradeAttemptInput,
	type GradeAttemptResult,
} from './grader';

// ---- Server-only modules: types re-exported here, values in `/server` ----
export type {
	EndSessionInput,
	RecordAttemptInput,
	StartSessionInput,
} from './server/queries';
