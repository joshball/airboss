/**
 * Phase 10 -- `forms` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { FORMS_RESOLVER } from './resolver.ts';

registerCorpusResolver(FORMS_RESOLVER);

export { formatFormsCitation } from './citation.ts';
export { formatFormsLocator, parseFormsLocator } from './locator.ts';
export { FORMS_CORPUS, FORMS_RESOLVER } from './resolver.ts';
export {
	FORMS_SEED_REVIEWER_ID,
	type FormsSeedOptions,
	type FormsSeedReport,
	seedFormsFromManifest,
} from './seed.ts';
export { getFormsLiveUrl } from './url.ts';
