/**
 * Phase 10 -- `sectionals` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { SECTIONALS_RESOLVER } from './resolver.ts';

registerCorpusResolver(SECTIONALS_RESOLVER);

export { formatSectionalsCitation } from './citation.ts';
export { formatSectionalsLocator, parseSectionalsLocator } from './locator.ts';
export { SECTIONALS_CORPUS, SECTIONALS_RESOLVER } from './resolver.ts';
export {
	SECTIONALS_SEED_REVIEWER_ID,
	type SectionalsSeedOptions,
	type SectionalsSeedReport,
	seedSectionalsFromManifest,
} from './seed.ts';
export { getSectionalsLiveUrl } from './url.ts';
