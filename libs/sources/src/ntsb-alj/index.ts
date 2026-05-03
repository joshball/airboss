/**
 * `ntsb-alj` corpus public surface.
 *
 * Importing this module registers the production `ntsb-alj` `CorpusResolver`
 * by side effect (replacing the bootstrap default no-op). The lib root
 * imports this module so any consumer of `@ab/sources` gets the resolver
 * wired automatically.
 *
 * Source of truth: WP-NTSB-ALJ spec at `docs/work-packages/wp-ntsb-alj/spec.md`,
 * library-completeness §4.A, ADR 019 §2.2 (corpus resolver registration), §2.6
 * (registry population pattern).
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { NTSB_ALJ_RESOLVER } from './resolver.ts';

registerCorpusResolver(NTSB_ALJ_RESOLVER);

export { formatNtsbAljCitation } from './citation.ts';
export { formatNtsbAljLocator, parseNtsbAljLocator } from './locator.ts';
export { NTSB_ALJ_CORPUS, NTSB_ALJ_RESOLVER } from './resolver.ts';
export {
	NTSB_ALJ_SEED_REVIEWER_ID,
	type NtsbAljSeedOptions,
	type NtsbAljSeedReport,
	seedNtsbAljFromManifest,
} from './seed.ts';
export { getNtsbAljLiveUrl } from './url.ts';
