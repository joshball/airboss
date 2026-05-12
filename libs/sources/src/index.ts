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

// Side-effect import: registers the `regs` CorpusResolver.
import './regs/index.ts';
// Side-effect import: registers the `handbooks` CorpusResolver.
import './handbooks/index.ts';
// Side-effect import: registers the `acs` CorpusResolver.
import './acs/index.ts';
// Side-effect import: registers the `pts` CorpusResolver.
import './pts/index.ts';
// Side-effect import: registers the `aim` CorpusResolver.
import './aim/index.ts';
// Side-effect import: registers the `ac` CorpusResolver.
import './ac/index.ts';
// Side-effect import: registers the `orders` CorpusResolver (Phase 10).
import './orders/index.ts';
// Side-effect import: registers the `ntsb` CorpusResolver (Phase 10).
import './ntsb/index.ts';
// Side-effect imports: register the Phase 10 next-slice irregular corpora resolvers.
import './interp/index.ts';
import './pohs/index.ts';
import './sectionals/index.ts';
import './plates/index.ts';
import './statutes/index.ts';
import './forms/index.ts';
import './info/index.ts';
import './safo/index.ts';
import './tcds/index.ts';
import './asrs/index.ts';
// Side-effect import: registers the `ntsb-alj` CorpusResolver (WP-NTSB-ALJ).
import './ntsb-alj/index.ts';

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
// `hydrateRegsFromDerivatives` + `PHASE_9_BOOTSTRAP_REVIEWER_ID` are
// server-only -- they live in `bootstrap.ts`, which statically imports
// `node:fs` at module load. Value re-exporting them here pulls `bootstrap.ts`
// into every `.svelte` page that touches `@ab/sources` (e.g. via
// `urlForReference`), which crashes hydration with Vite's
// `Module "node:fs" has been externalized` browser stub.
//
// Canonical server-barrel-split pattern: value re-exports move to
// `@ab/sources/server`; only type re-exports stay in the runtime barrel
// (types erase at compile time, no transitive evaluation).
export type { BootstrapOptions, BootstrapReport } from './bootstrap.ts';
export { parseHandbooksLocator } from './handbooks/locator.ts';
export { isParseError, parseIdentifier } from './parser.ts';
export { ENUMERATED_CORPORA, getCorpusResolver, initRegistry, productionRegistry } from './registry/index.ts';
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
	writeCfrNavTree,
} from './regs/nav-tree.ts';
export {
	__batch_internal__,
	batchResolve,
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
