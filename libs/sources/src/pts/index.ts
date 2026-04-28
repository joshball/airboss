/**
 * `pts` corpus public surface.
 *
 * Importing this module registers the `pts` `CorpusResolver` by side effect
 * (replacing the Phase 2 default no-op). The lib root imports this module
 * so any consumer of `@ab/sources` gets the resolver wired automatically.
 *
 * Source of truth: ADR 019 §1.2, §2.2 + the cert-syllabus WP's locked Q7
 * format.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { PTS_RESOLVER } from './resolver.ts';

registerCorpusResolver(PTS_RESOLVER);

export { formatPtsCitation } from './citation.ts';
export { formatPtsLocator, parsePtsLocator, PTS_PUBLICATION_SLUGS } from './locator.ts';
export { PTS_CORPUS, PTS_RESOLVER } from './resolver.ts';
export { getPtsLiveUrl, PTS_PUBLICATION_LIVE_URLS, PTS_TEST_STANDARDS_INDEX_URL } from './url.ts';
