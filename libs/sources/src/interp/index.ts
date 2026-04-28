/**
 * Phase 10 -- `interp` corpus public surface.
 *
 * Importing this module registers the production `interp` `CorpusResolver`
 * by side effect.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { INTERP_RESOLVER } from './resolver.ts';

registerCorpusResolver(INTERP_RESOLVER);

export { formatInterpCitation } from './citation.ts';
export { formatInterpLocator, parseInterpLocator } from './locator.ts';
export { INTERP_CORPUS, INTERP_RESOLVER } from './resolver.ts';
export {
	INTERP_SEED_REVIEWER_ID,
	type InterpSeedOptions,
	type InterpSeedReport,
	seedInterpFromManifest,
} from './seed.ts';
export { getInterpLiveUrl } from './url.ts';
