/**
 * Phase 10 -- `info` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { INFO_RESOLVER } from './resolver.ts';

registerCorpusResolver(INFO_RESOLVER);

export { formatInfoCitation } from './citation.ts';
export { formatInfoLocator, parseInfoLocator } from './locator.ts';
export { INFO_CORPUS, INFO_RESOLVER } from './resolver.ts';
export { getInfoLiveUrl } from './url.ts';
