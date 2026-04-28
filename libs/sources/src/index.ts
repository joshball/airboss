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

export {
	type BootstrapOptions,
	type BootstrapReport,
	hydrateRegsFromDerivatives,
	PHASE_9_BOOTSTRAP_REVIEWER_ID,
} from './bootstrap.ts';
export { isParseError, parseIdentifier } from './parser.ts';
export { getCorpusResolver, productionRegistry } from './registry/index.ts';
export { NULL_REGISTRY } from './registry-stub.ts';
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
export * from './types.ts';
