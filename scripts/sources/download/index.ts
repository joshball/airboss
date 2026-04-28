/**
 * Public surface of the `scripts/sources/download/` module.
 *
 * `runDownloadSources` is the orchestrator the dispatcher calls.
 * `__download_internal__` exposes the test-time accessors used by
 * `scripts/sources/download.test.ts`. New callers should not depend on the
 * internal namespace -- it exists for the test suite.
 */

import { ALL_CORPORA, type Corpus, isCorpus, parseArgs } from './args';
import {
	_setCachedTitlesForTest,
	ECFR_TITLES_URL,
	type EcfrTitleMeta,
	type EcfrTitlesResponse,
	fetchEcfrTitles,
	latestAmendedOnFor,
} from './ecfr';
import { evaluateFreshness } from './freshness';
import { headRequest } from './http';
import { manifestPathFor } from './manifest';
import {
	AC_TARGETS,
	ACS_TARGETS,
	AIM_PDF_URL,
	buildEcfrUrl,
	buildPlans,
	currentMonthEdition,
	HANDBOOKS_EXTRAS_TARGETS,
	USER_AGENT,
} from './plans';

export type { CliArgs } from './args';
export type { Manifest } from './manifest';
export type { DownloadPlan } from './plans';
export { type RunOptions, runDownloadSources } from './run';
export type { CorpusResult, VerifyRow } from './summary';
export type { Corpus, EcfrTitleMeta, EcfrTitlesResponse };
export { ALL_CORPORA, isCorpus };

/**
 * Test-only accessors. Imported by `scripts/sources/download.test.ts` so the
 * test suite can drive the same parsers and seam helpers the entry point uses.
 */
export const __download_internal__ = {
	parseArgs,
	buildPlans,
	buildEcfrUrl,
	currentMonthEdition,
	manifestPathFor,
	evaluateFreshness,
	headRequest,
	fetchEcfrTitles,
	latestAmendedOnFor,
	_setCachedTitlesForTest,
	AC_TARGETS,
	ACS_TARGETS,
	HANDBOOKS_EXTRAS_TARGETS,
	AIM_PDF_URL,
	USER_AGENT,
	ECFR_TITLES_URL,
};
