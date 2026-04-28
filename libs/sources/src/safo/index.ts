/**
 * Phase 10 -- `safo` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { SAFO_RESOLVER } from './resolver.ts';

registerCorpusResolver(SAFO_RESOLVER);

export { formatSafoCitation } from './citation.ts';
export { formatSafoLocator, parseSafoLocator } from './locator.ts';
export { SAFO_CORPUS, SAFO_RESOLVER } from './resolver.ts';
export { getSafoLiveUrl } from './url.ts';
