/**
 * Phase 5 -- public surface for the versioning + diff job.
 *
 * Source of truth: ADR 019 §5 (versioning workflow), §6.1 (alias kinds).
 *
 * The annual rollover diff job + lesson rewriter that closes the loop on
 * "what changed between editions, and which lessons can advance pins safely."
 */

export { type AliasOutcome, resolveAliasOutcome } from './alias-resolver.ts';
export { clearBodyHashCache, hashEditionBody, readNormalizedBody } from './body-hasher.ts';
export {
	parseAdvanceArgs,
	parseDiffArgs,
	runAdvanceCli,
	runDiffCli,
} from './cli.ts';
export {
	type DiffJobArgs,
	type DiffJobResult,
	findAutoAdvanceCandidates,
	findNeedsReviewCandidates,
	formatDiffSummary,
	runDiffJob,
} from './diff-job.ts';
export { type RewriteOpts, RewriterError, runRewrite } from './lesson-rewriter.ts';
export {
	type EditionPair,
	latestEditionPair,
	latestTwoEditionsForCorpus,
	walkEditionPairs,
} from './pair-walker.ts';
export {
	ADVANCEABLE_KINDS,
	ALL_OUTCOME_KINDS,
	type DiffOutcome,
	type DiffOutcomeKind,
	type DiffReport,
	type RewriteReport,
	type RewriteSkip,
} from './types.ts';
export { buildSnippet } from './unified-diff.ts';
