/**
 * `@ab/content-census` -- runtime barrel. Browser-safe.
 *
 * Exports only census types and pure helpers. The corpus adapters touch
 * `node:fs` and live behind the `/server` barrel (`@ab/content-census/server`)
 * -- they must never be re-exported here, or the postgres-free filesystem
 * code would still pull `node:fs` into every page bundle.
 *
 * A `.svelte` component or non-server `.ts` file imports from here (for the
 * `CorpusCensus` types and the overview helpers). A `+page.server.ts` imports
 * the adapters from `@ab/content-census/server`.
 */

export type {
	CensusGap,
	CensusHealth,
	CensusItem,
	CensusMetric,
	CensusMode,
	CensusNextItem,
	CensusOverviewRow,
	ContentIntent,
	CorpusCensus,
	DocLink,
} from './types';

export { corpusHealth, plannedWorkCount, stateDistribution, toOverviewRow } from './overview';

export {
	CORPUS_IDS,
	CORPUS_REGISTRY,
	type CorpusDescriptor,
	type CorpusId,
} from './registry';
