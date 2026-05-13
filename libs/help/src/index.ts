// @ab/help -- help-content library.
//
// Schema + registry + search + validation are exported here. UI components
// are loaded by path (symmetric with @ab/aviation and @ab/ui) so non-UI
// consumers don't pull in the svelte runtime:
//
//   import HelpLayout from '@ab/help/ui/HelpLayout.svelte';
//   import HelpSearch from '@ab/help/ui/HelpSearch.svelte';

export { paletteCommands } from './commands/registry';
export type { PaletteCommand, PaletteCommandRegistry, PaletteCommandType } from './commands/types';
export { classifyIntent, hasAnyTitlePrefixMatch, type SearchIntent, wordCount } from './intent-classifier';
export {
	type CalloutVariant,
	type DirectiveNode,
	highlight,
	type InlineNode,
	MarkdownParseError,
	type MdNode,
	parseMarkdown,
	parseMarkdownSync,
	SUPPORTED_LANGS,
	type SupportedLang,
	type TableAlign,
} from './markdown';
export { parseQuery } from './query-parser';
export { helpRegistry } from './registry';
export {
	EXTERNAL_REF_SOURCE_VALUES,
	type ExternalRef,
	type ExternalRefSource,
	sourceFromUrl,
} from './schema/external-ref';
export type { HelpPage } from './schema/help-page';
export type { HelpPageBody } from './schema/help-page-body';
export type { HelpPageIndex, HelpSectionIndex } from './schema/help-page-index';
export type {
	FilterKey,
	HelpBodyLoader,
	HelpRegistry,
	ParsedFilter,
	ParsedQuery,
	SearchFilters,
	SearchResult,
	SearchResultSet,
} from './schema/help-registry';
export type { HelpSection } from './schema/help-section';
export type { HelpTags } from './schema/help-tags';
export {
	PALETTE_MODE_ELIGIBLE,
	PALETTE_MODES,
	type PaletteMode,
} from './schema/palette-mode';
export {
	COLUMN_BY_TYPE,
	COLUMN_LABELS,
	COLUMN_ORDER,
	type DocCluster,
	EMPTY_GROUPED_RESULTS,
	type GroupedResults,
	type PaletteHost,
	type RankBucket,
	type ResultColumn,
	type ResultSource,
	type SearchResult as TypedSearchResult,
	type SearchResultType,
	type SynonymRewrite,
	type WebToolTier,
} from './schema/result-types';
export { listAviationReferences, search, searchGrouped } from './search';
export {
	bodyMatchTier,
	bucketFromScore,
	type IndexedRankInput,
	matchesFilters,
	rankBucket,
	rankBucketIndexed,
	type SearchResultInput,
	scoreResult,
	TYPE_TIER,
	titleMatchTier,
} from './search-core';
export {
	type HelpValidationIssue,
	type HelpValidationOptions,
	type HelpValidationResult,
	validateHelpPages,
} from './validation';
