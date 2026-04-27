/**
 * `acs` corpus public surface.
 *
 * Importing this module registers the `acs` `CorpusResolver` by side effect
 * (replacing the Phase 2 default no-op). The lib root imports this module so
 * any consumer of `@ab/sources` gets the resolver wired automatically.
 *
 * Source of truth: ADR 019 §1.2 (`acs` shape), §2.2 (corpus resolver
 * registration), and the WP at
 * `docs/work-packages/cert-syllabus-and-goal-composer/`.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { ACS_RESOLVER } from './resolver.ts';

registerCorpusResolver(ACS_RESOLVER);

export { formatAcsCitation } from './citation.ts';
export { ACS_CERT_SLUGS, formatAcsLocator, parseAcsLocator } from './locator.ts';
export { ACS_CORPUS, ACS_RESOLVER } from './resolver.ts';
export { ACS_CERT_LIVE_URLS, ACS_TEST_STANDARDS_INDEX_URL, getAcsLiveUrl } from './url.ts';
