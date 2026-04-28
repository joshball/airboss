/**
 * Phase 10 -- `pohs` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { POHS_RESOLVER } from './resolver.ts';

registerCorpusResolver(POHS_RESOLVER);

export { formatPohsCitation } from './citation.ts';
export { formatPohsLocator, parsePohsLocator } from './locator.ts';
export { POHS_CORPUS, POHS_RESOLVER } from './resolver.ts';
export {
	POHS_SEED_REVIEWER_ID,
	type PohsSeedOptions,
	type PohsSeedReport,
	seedPohsFromManifest,
} from './seed.ts';
export { getPohsLiveUrl } from './url.ts';
