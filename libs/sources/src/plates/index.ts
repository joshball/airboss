/**
 * Phase 10 -- `plates` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { PLATES_RESOLVER } from './resolver.ts';

registerCorpusResolver(PLATES_RESOLVER);

export { formatPlatesCitation } from './citation.ts';
export { formatPlatesLocator, parsePlatesLocator } from './locator.ts';
export { PLATES_CORPUS, PLATES_RESOLVER } from './resolver.ts';
export { getPlatesLiveUrl } from './url.ts';
