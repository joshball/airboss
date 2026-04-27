/**
 * Phase 6 -- `handbooks` corpus public surface.
 *
 * Importing this module registers the production `handbooks` `CorpusResolver`
 * by side effect (replacing the Phase 2 default no-op). The lib root imports
 * this module so any consumer of `@ab/sources` gets the resolver wired
 * automatically.
 *
 * Source of truth: ADR 019 §1.2 (`handbooks` shape), §2.2 (corpus resolver
 * registration), §2.6 (registry population pattern), and the WP at
 * `docs/work-packages/reference-handbook-ingestion/`.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { HANDBOOKS_RESOLVER } from './resolver.ts';

registerCorpusResolver(HANDBOOKS_RESOLVER);

export { formatHandbooksCitation } from './citation.ts';
export {
	bodyPathForSection,
	locatorToManifestCode,
	type ManifestFile,
	type ManifestSection,
	manifestSectionForLocator,
	readManifest,
} from './derivative-reader.ts';
export {
	type CliArgs,
	type IngestOneHandbookArgs,
	type IngestReport,
	PHASE_6_REVIEWER_ID,
	parseCliArgs,
	runHandbookIngest,
	runIngestCli,
} from './ingest.ts';
export { HANDBOOK_DOC_SLUGS, parseHandbooksLocator } from './locator.ts';
export {
	__handbooks_resolver_internal__,
	getHandbooksDerivativeRoot,
	HANDBOOK_DOC_EDITIONS,
	HANDBOOKS_CORPUS,
	HANDBOOKS_RESOLVER,
	setHandbooksDerivativeRoot,
} from './resolver.ts';
export { getHandbooksLiveUrl, HANDBOOK_LIVE_URLS } from './url.ts';
