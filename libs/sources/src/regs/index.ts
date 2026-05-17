/**
 * Phase 3 -- `regs` corpus public surface.
 *
 * Importing this module registers the production `regs` `CorpusResolver` by
 * side effect (replacing the Phase 2 default no-op). The Phase 2 lib root
 * imports this module so any consumer of `@ab/sources` gets the resolver
 * wired automatically.
 *
 * Source of truth: ADR 019 §2.2 (corpus resolver registration), §2.6
 * (registry population pattern), and the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { REGS_RESOLVER } from './resolver.ts';

registerCorpusResolver(REGS_RESOLVER);

export { cacheXmlPath, loadEcfrXml, resolveCacheRoot } from './cache.ts';
export { formatRegsCitation } from './citation.ts';
export { writeDerivativeTree } from './derivative-writer.ts';
// The CFR ingest CLI (`runIngest`, `runIngestCli`, ...) is NOT re-exported
// here. `ingest.ts` value-imports `xml-walker.ts`, which value-imports the
// third-party `fast-xml-parser`. This module is the `regs` resolver-
// registration entry point, side-effect-imported by `@ab/sources/server`
// into EVERY server bundle -- so re-exporting the ingest CLI dragged
// `fast-xml-parser` into the flightbag SSR bundle (which has no XML-ingest
// path) and `vite build` failed to resolve it. Ingest callers import the
// CLI directly from `@ab/sources/regs/ingest`: `scripts/sources/register/
// cfr.ts` (the dispatcher) and `diff/cli.ts`.
export { parseRegsLocator } from './locator.ts';
export {
	buildEcfrUrl,
	buildPartUrl,
	buildSectionUrl,
	type CfrNavChapter,
	type CfrNavSubchapter,
	type CfrNavTree,
	type CfrTitleNumber,
	findChapterForPart,
	getCfrNavTree,
	logUnmappedParts,
	type PartLocation,
} from './nav-tree.ts';
export { type WriteCfrNavTreeInput, writeCfrNavTree } from './nav-tree-writer.ts';
export {
	normalizeRawPart,
	normalizeRawSection,
	normalizeRawSubpart,
} from './normalizer.ts';
export { getRegsDerivativeRoot, REGS_CORPUS, REGS_RESOLVER, setRegsDerivativeRoot } from './resolver.ts';
export { getRegsLiveUrl } from './url.ts';
// `walkRegsXml` is NOT re-exported here. `xml-walker.ts` value-imports
// `fast-xml-parser`, and `regs/index.ts` is the resolver-registration module
// loaded by every server bundle via `@ab/sources/server`. Re-exporting the
// XML walker dragged `fast-xml-parser` into the flightbag SSR bundle, which
// has no XML-ingest path -- and `vite build` failed to resolve it. The only
// caller (`regs/ingest.ts`, an ingest-time module) imports `walkRegsXml`
// directly from `./xml-walker.ts`; CLI ingest is the sole legitimate
// consumer.
