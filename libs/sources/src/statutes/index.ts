/**
 * Phase 10 -- `statutes` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { STATUTES_RESOLVER } from './resolver.ts';

registerCorpusResolver(STATUTES_RESOLVER);

export { formatStatutesCitation } from './citation.ts';
export { formatStatutesLocator, parseStatutesLocator } from './locator.ts';
export { STATUTES_CORPUS, STATUTES_RESOLVER } from './resolver.ts';
export {
	STATUTES_SEED_REVIEWER_ID,
	type StatutesSeedOptions,
	type StatutesSeedReport,
	seedStatutesFromManifest,
} from './seed.ts';
export { getStatutesLiveUrl } from './url.ts';
