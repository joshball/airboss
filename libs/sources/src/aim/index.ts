/**
 * Phase 7 -- `aim` corpus public surface.
 *
 * Importing this module registers the production `aim` `CorpusResolver` by
 * side effect (replacing the Phase 2 default no-op). The lib root imports
 * this module so any consumer of `@ab/sources` gets the resolver wired
 * automatically.
 *
 * Source of truth: ADR 019 §1.2 (`aim` shape), §2.2 (corpus resolver
 * registration), §2.6 (registry population pattern), and the WP at
 * `docs/work-packages/reference-aim-ingestion/`.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { AIM_RESOLVER } from './resolver.ts';

registerCorpusResolver(AIM_RESOLVER);

export { formatAimCitation } from './citation.ts';
export {
	bodyPathForEntry,
	locatorToManifestCode,
	type ManifestEntry,
	type ManifestFile,
	manifestEntryForLocator,
	readManifest,
} from './derivative-reader.ts';
export {
	type CliArgs,
	type IngestArgs,
	type IngestReport,
	PHASE_7_REVIEWER_ID,
	parseCliArgs,
	runAimIngest,
	runIngestCli,
} from './ingest.ts';
export { parseAimLocator } from './locator.ts';
export {
	__aim_resolver_internal__,
	AIM_CORPUS,
	AIM_RESOLVER,
	getAimDerivativeRoot,
	setAimDerivativeRoot,
} from './resolver.ts';
export { AIM_LIVE_URL, getAimLiveUrl } from './url.ts';
