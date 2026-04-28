/**
 * Phase 10 -- `asrs` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { ASRS_RESOLVER } from './resolver.ts';

registerCorpusResolver(ASRS_RESOLVER);

export { formatAsrsCitation } from './citation.ts';
export { formatAsrsLocator, parseAsrsLocator } from './locator.ts';
export { ASRS_CORPUS, ASRS_RESOLVER } from './resolver.ts';
export { getAsrsLiveUrl } from './url.ts';
