/**
 * `@ab/sources` -- the canonical-corpus reference lib.
 *
 * Phase 1: URI parser + rule-engine validator + lesson Markdown walker for the
 * `airboss-ref:` identifier scheme. Source of truth: ADR 019.
 *
 * Phase 2: registry constants table, per-corpus resolver registration,
 * lifecycle state machine, and the production `RegistryReader` assembly.
 *
 * Phase 3: real `regs` `CorpusResolver` registered by side effect when this
 * module is imported.
 */

// CorpusResolver registration is server-only -- each corpus `index.ts`
// imports `node:fs` transitively (via its `resolver.ts`) which crashes
// hydration in the browser via Vite's externalized-node-builtin stub.
// The 19 side-effect imports now live in `@ab/sources/server`. Server-
// side callers (`hooks.server.ts`'s `initRegistry` chain, `+page.server.ts`
// route handlers, scripts) must import from `@ab/sources/server` to
// trigger resolver registration. The runtime barrel below stays pure
// value-pass-through (parsers, locators, types).

export { parseAcLocator } from './ac/locator.ts';
export {
	__ac_seed_mapping_internal__,
	getAcSeedMapping,
	getAcSeedMappingByReference,
	listAcSeedMappings,
} from './ac/seed-mapping.ts';
export { parseAcsLocator } from './acs/locator.ts';
export { parseAimLocator } from './aim/locator.ts';
export {
	airbossRefForAcDocument,
	airbossRefForAcSection,
	airbossRefForAcsArea,
	airbossRefForAcsElement,
	airbossRefForAcsPublication,
	airbossRefForAcsTask,
	airbossRefForAimEntry,
	airbossRefForCfrSection,
	airbossRefForCfrSubpart,
	airbossRefForGenericDocument,
	airbossRefForHandbookSection,
	airbossRefForInfo,
	airbossRefForNtsbAljDocument,
	airbossRefForNtsbAljSection,
	airbossRefForSafo,
	airbossRefForWholeDocHandbook,
	CORPUS_PREFIX_FOR_REFERENCE_KIND,
	sourceIdForReference,
} from './airboss-ref-builder.ts';
// `bootstrap.ts` is server-only -- it statically imports `node:fs` at module
// load. The entire module must stay out of the runtime barrel: even an
// `export type { ... } from './bootstrap.ts'` re-export causes Vite's dev
// server to evaluate `bootstrap.ts` on resolution, which crashes hydration
// with the `Module "node:fs" has been externalized` browser stub. Types AND
// values both live in `@ab/sources/server`; intra-lib callers can import
// directly from `./bootstrap.ts`.
export { parseHandbooksLocator } from './handbooks/locator.ts';
export { isParseError, parseIdentifier } from './parser.ts';
export { ENUMERATED_CORPORA } from './registry/corpus-resolver.ts';
// `getCorpusResolver`, `initRegistry`, `productionRegistry` moved to
// `@ab/sources/server` -- they reach `registry/query.ts` which static-imports
// `node:fs`. Pulling them through the runtime barrel crashes hydration.
export { NULL_REGISTRY } from './registry-stub.ts';
export { parseRegsLocator } from './regs/locator.ts';
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
} from './regs/nav-tree.ts';
// `writeCfrNavTree` lives in the server-only `regs/nav-tree-writer.ts` and is
// re-exported from `@ab/sources/server` -- it reaches `node:fs` via
// `write-if-changed.ts`, which a production `vite build` would pull into the
// client bundle if the writer stayed in `nav-tree.ts`. Ingest callers
// (`regs/ingest.ts`, scripts) import from the server barrel.
// `batchResolve` + `__batch_internal__` are NOT re-exported here -- they reach
// `registry/query.ts` (which static-imports `node:fs`) and crash browser
// hydration. They live on `@ab/sources/server`; SvelteKit `+page.server.ts`
// loaders + `lib/server/**` import them from there.
export {
	computeAdjacencyGroups,
	computeAnnotation,
	extractIdentifiers,
	findMatchingAcks,
	formatListText,
	fromSerializable,
	getToken,
	indexGroupsByMember,
	listTokens,
	memberIndex,
	registerToken,
	renderDefaultModeLink,
	renderPlainTextLink,
	renderPrintLink,
	renderTtsLink,
	renderWebLink,
	substituteTokens,
	toSerializable,
} from './render/index.ts';
export {
	cachedSourcePdfExists,
	describeSourcePdf,
	resolveCachedSourcePdfPath,
	type SourcePdfDescriptor,
} from './source-pdf.ts';
export * from './types.ts';
export { urlForReference } from './url-for-reference.ts';
