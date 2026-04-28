/**
 * Phase 10 -- `orders` corpus public surface.
 *
 * Importing this module registers the production `orders` `CorpusResolver`
 * by side effect (replacing the Phase 2 default no-op). The lib root
 * imports this module so any consumer of `@ab/sources` gets the resolver
 * wired automatically.
 *
 * Source of truth: ADR 019 §1.2 (`orders` shape), §2.2 (corpus resolver
 * registration), §2.6 (registry population pattern).
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { ORDERS_RESOLVER } from './resolver.ts';

registerCorpusResolver(ORDERS_RESOLVER);

export { formatOrdersCitation } from './citation.ts';
export { formatOrdersLocator, parseOrdersLocator } from './locator.ts';
export { ORDERS_CORPUS, ORDERS_RESOLVER } from './resolver.ts';
export {
	ORDERS_SEED_REVIEWER_ID,
	type OrdersSeedOptions,
	type OrdersSeedReport,
	seedOrdersFromManifest,
} from './seed.ts';
export { getOrdersLiveUrl } from './url.ts';
