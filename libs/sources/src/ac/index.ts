/**
 * Phase 8 -- `ac` corpus public surface.
 *
 * Importing this module registers the production `ac` `CorpusResolver` by
 * side effect (replacing the Phase 2 default no-op). The lib root imports
 * this module so any consumer of `@ab/sources` gets the resolver wired
 * automatically.
 *
 * Source of truth: ADR 019 §1.2 (`ac` shape), §2.2 (corpus resolver
 * registration), §2.6 (registry population pattern).
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { AC_RESOLVER } from './resolver.ts';

registerCorpusResolver(AC_RESOLVER);

export { formatAcCitation } from './citation.ts';
export {
	type AcCorpusIndex,
	type AcCorpusIndexEntry,
	type AcManifestChange,
	type AcManifestFile,
	type AcManifestSection,
	docSlugFromDocNumber,
	readAcManifest,
	readCorpusIndex,
} from './derivative-reader.ts';
export {
	type CliArgs,
	type IngestArgs,
	type IngestReport,
	PHASE_8_REVIEWER_ID,
	parseCliArgs,
	runAcIngest,
	runIngestCli,
} from './ingest.ts';
export { formatAcLocator, parseAcLocator } from './locator.ts';
export {
	__ac_resolver_internal__,
	AC_CORPUS,
	AC_RESOLVER,
	getAcDerivativeRoot,
	setAcDerivativeRoot,
} from './resolver.ts';
export { getAcLiveUrl } from './url.ts';
