// Wx-practice BC -- server-only barrel.
//
// Every value export resolves to a module that imports `@ab/db/connection`.
// Consumers: `+page.server.ts`, `+server.ts`, `apps/study/src/lib/server/**`.
// Import as `from '@ab/bc-wx-practice/server'`.
//
// Also re-exports the pure helpers from the runtime barrel as a convenience
// for server-only consumers (so a `+server.ts` only has to import from
// `@ab/bc-wx-practice/server`).

// Pure helpers (also exported from `@ab/bc-wx-practice`).
export { defaultQuestionForm, type GradeAttemptInput, type GradeAttemptResult, gradeAttempt } from './grader';
export { type DrillToken, masteryKey, type SampledItem, type SamplerInput, sampleSession } from './sampler';
// Server-only queries.
export {
	buildMasteryMap,
	type EndSessionInput,
	endSession,
	generateWxPracticeAttemptId,
	generateWxPracticeSessionId,
	getMasteryFor,
	getSession,
	type MasteryFilter,
	type RecordAttemptInput,
	type RecordAttemptResult,
	recordAttempt,
	type SessionSummary,
	type StartSessionInput,
	startSession,
	summarizeSession,
} from './server/queries';
export {
	type ApplyAttemptInput,
	type ApplyAttemptResult,
	applyAttempt,
	type MasterySnapshot,
	type MasteryTransition,
} from './state-machine';
