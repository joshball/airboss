// @ab/aviation -- aviation reference library.
//
// Schema + registry + validation + wikilink parser are exported here. UI
// components are loaded by path (symmetric with @ab/ui) so non-UI
// consumers don't pull in the svelte runtime:
//
//   import ReferencePage from '@ab/aviation/ui/ReferencePage.svelte';
//
// Source extractors (CfrExtractor, allExtractors, resolveExtractors) pull
// `node:fs` transitively and live at `@ab/aviation/sources` so the client
// bundle never sees them. Scripts import from there directly.
//
// The legacy seed-source catalog (PENDING_DOWNLOAD, SOURCES, getSource,
// getSourcesByType, isSourceDownloaded) lives at `@ab/bc-hangar` next to the
// `hangar.source` schema that owns the live state machine. Hangar surfaces
// and the references extraction pipeline import the seeds from there.

export type { DocCodeFamily, DocCodeIntent } from './doc-code-detector';
export { detectDocCodeIntent, lookupDocsByCode } from './doc-code-detector';
export {
	EXTERNAL_TOOLS,
	type ExternalTool,
	findExternalTools,
	getExternalToolById,
	type WebToolTier,
} from './external-tools';
export { AIM_REFERENCES } from './references/aim-docs';
// Both reference modules self-register at module-load via `registerReferences`.
// Import them here so the registry is populated before any consumer reads it.
export { AVIATION_REFERENCES } from './references/aviation';
export { FAA_DOC_REFERENCES } from './references/faa-docs';
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
	type SearchHit,
	type SearchQuery,
	search,
	type TagQuery,
} from './registry';
export type { Reference, VerbatimBlock } from './schema/reference';
export {
	isSourceEdition,
	isSourceMedia,
	type Source,
	type SourceCitation,
	type SourceEdition,
	type SourceExtractor,
	type SourceMedia,
} from './schema/source';
export {
	isAviationTopic,
	isCertApplicability,
	isFlightRules,
	isKnowledgeKind,
	isPhaseOfFlight,
	isSourceType,
	type ReferenceTags,
} from './schema/tags';
export {
	parseAircraftSlug,
	parseCertSlug,
	parseHandbookChapter,
	parseHandbookSection,
	parseHandbookSlug,
	parseRegulationGroup,
	parseRegulationKind,
	parseRegulationSection,
} from './slugs';
export { type CfrDocument, CfrParseError, type CfrSectionLocator, parseCfrXml } from './sources/cfr/parser';
export { isSourceMeta, metaPathFor, type SourceMeta } from './sources/meta';
export { AVIATION_SYNONYMS, expandQuery, expandToken } from './synonyms';
export { decodeReferences, decodeSources, encodeReferences, encodeSources } from './toml-codec';
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
