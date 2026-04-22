// @ab/aviation -- aviation reference library.
//
// Schema + registry + validation + wikilink parser are exported here. UI
// components are loaded by path (symmetric with @ab/ui) so non-UI
// consumers don't pull in the svelte runtime:
//
//   import ReferencePage from '@ab/aviation/ui/ReferencePage.svelte';

// Empty registry in Phase 1. Phase 2 populates aviation.ts + calls
// registerReferences() at module load.
export { AVIATION_REFERENCES } from './references/aviation';
export {
	__resetRegistryForTests,
	axisCounts,
	countReferences,
	findByTags,
	getReferenceById,
	getReferenceByTerm,
	hasReference,
	listReferences,
	registerReferences,
	type SearchQuery,
	search,
	type TagQuery,
} from './registry';
export type { Reference, VerbatimBlock } from './schema/reference';
export type { Source, SourceCitation, SourceExtractor } from './schema/source';
export {
	isAviationTopic,
	isCertApplicability,
	isFlightRules,
	isKnowledgeKind,
	isPhaseOfFlight,
	isSourceType,
	type ReferenceTags,
} from './schema/tags';
export { isSourceMeta, metaPathFor, type SourceMeta } from './sources/meta';
export { getSource, getSourcesByType, isSourceDownloaded, PENDING_DOWNLOAD, SOURCES } from './sources/registry';
export {
	type ContentScan,
	type ContentValidationSummary,
	type ValidationIssue,
	type ValidationResult,
	validateContentWikilinks,
	validateReferences,
} from './validation';
export {
	extractWikilinks,
	parseWikilinks,
	type WikilinkAstNode,
	type WikilinkParseError,
	type WikilinkParseResult,
} from './wikilink';
