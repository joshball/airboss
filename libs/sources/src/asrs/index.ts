/**
 * Phase 10 -- `asrs` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { ASRS_RESOLVER } from './resolver.ts';

registerCorpusResolver(ASRS_RESOLVER);

export { formatAsrsCitation } from './citation.ts';
export { formatAsrsLocator, parseAsrsLocator } from './locator.ts';
export { ASRS_CORPUS, ASRS_RESOLVER } from './resolver.ts';
export {
	ASRS_SEED_REVIEWER_ID,
	type AsrsSeedOptions,
	type AsrsSeedReport,
	seedAsrsFromManifest,
} from './seed.ts';
export { getAsrsLiveUrl } from './url.ts';
