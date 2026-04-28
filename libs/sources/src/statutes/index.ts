/**
 * Phase 10 -- `statutes` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { STATUTES_RESOLVER } from './resolver.ts';

registerCorpusResolver(STATUTES_RESOLVER);

export { formatStatutesCitation } from './citation.ts';
export { formatStatutesLocator, parseStatutesLocator } from './locator.ts';
export { STATUTES_CORPUS, STATUTES_RESOLVER } from './resolver.ts';
export { getStatutesLiveUrl } from './url.ts';
