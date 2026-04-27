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
// Side-effect import: registers the `aim` CorpusResolver.
import './aim/index.ts';

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
