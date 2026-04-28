/**
 * Phase 10 -- `sectionals` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { SECTIONALS_RESOLVER } from './resolver.ts';

registerCorpusResolver(SECTIONALS_RESOLVER);

export { formatSectionalsCitation } from './citation.ts';
export { formatSectionalsLocator, parseSectionalsLocator } from './locator.ts';
export { SECTIONALS_CORPUS, SECTIONALS_RESOLVER } from './resolver.ts';
export { getSectionalsLiveUrl } from './url.ts';
