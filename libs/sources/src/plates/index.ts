/**
 * Phase 10 -- `plates` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { PLATES_RESOLVER } from './resolver.ts';

registerCorpusResolver(PLATES_RESOLVER);

export { formatPlatesCitation } from './citation.ts';
export { formatPlatesLocator, parsePlatesLocator } from './locator.ts';
export { PLATES_CORPUS, PLATES_RESOLVER } from './resolver.ts';
export {
	PLATES_SEED_REVIEWER_ID,
	type PlatesSeedOptions,
	type PlatesSeedReport,
	seedPlatesFromManifest,
} from './seed.ts';
export { getPlatesLiveUrl } from './url.ts';
