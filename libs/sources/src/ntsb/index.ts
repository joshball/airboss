/**
 * Phase 10 -- `ntsb` corpus public surface.
 *
 * Importing this module registers the production `ntsb` `CorpusResolver`
 * by side effect (replacing the Phase 2 default no-op). The lib root
 * imports this module so any consumer of `@ab/sources` gets the resolver
 * wired automatically.
 *
 * Source of truth: ADR 019 §1.2 (`ntsb` shape), §2.2 (corpus resolver
 * registration), §2.6 (registry population pattern).
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { NTSB_RESOLVER } from './resolver.ts';

registerCorpusResolver(NTSB_RESOLVER);

export { formatNtsbCitation } from './citation.ts';
export { formatNtsbLocator, parseNtsbLocator } from './locator.ts';
export { NTSB_CORPUS, NTSB_RESOLVER } from './resolver.ts';
export {
	NTSB_SEED_REVIEWER_ID,
	type NtsbSeedOptions,
	type NtsbSeedReport,
	seedNtsbFromManifest,
} from './seed.ts';
export { getNtsbLiveUrl } from './url.ts';
