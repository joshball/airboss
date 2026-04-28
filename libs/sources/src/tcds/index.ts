/**
 * Phase 10 -- `tcds` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { TCDS_RESOLVER } from './resolver.ts';

registerCorpusResolver(TCDS_RESOLVER);

export { formatTcdsCitation } from './citation.ts';
export { formatTcdsLocator, parseTcdsLocator } from './locator.ts';
export { TCDS_CORPUS, TCDS_RESOLVER } from './resolver.ts';
export { getTcdsLiveUrl } from './url.ts';
