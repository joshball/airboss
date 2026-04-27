/**
 * Phase 3 -- `regs` corpus public surface.
 *
 * Importing this module registers the production `regs` `CorpusResolver` by
 * side effect (replacing the Phase 2 default no-op). The Phase 2 lib root
 * imports this module so any consumer of `@ab/sources` gets the resolver
 * wired automatically.
 *
 * Source of truth: ADR 019 §2.2 (corpus resolver registration), §2.6
 * (registry population pattern), and the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { REGS_RESOLVER } from './resolver.ts';

registerCorpusResolver(REGS_RESOLVER);

export { cacheXmlPath, loadEcfrXml, resolveCacheRoot } from './cache.ts';
export { formatRegsCitation } from './citation.ts';
export { writeDerivativeTree } from './derivative-writer.ts';
export {
	PHASE_3_REVIEWER_ID,
	parseCliArgs,
	runIngest,
	runIngestCli,
} from './ingest.ts';
export { parseRegsLocator } from './locator.ts';
export {
	normalizeRawPart,
	normalizeRawSection,
	normalizeRawSubpart,
} from './normalizer.ts';
export { getRegsDerivativeRoot, REGS_CORPUS, REGS_RESOLVER, setRegsDerivativeRoot } from './resolver.ts';
export { getRegsLiveUrl } from './url.ts';
export { walkRegsXml } from './xml-walker.ts';
