// @ab/help -- help-content library.
//
// Schema + registry + search + validation are exported here. UI components
// are loaded by path (symmetric with @ab/aviation and @ab/ui) so non-UI
// consumers don't pull in the svelte runtime:
//
//   import HelpLayout from '@ab/help/ui/HelpLayout.svelte';
//   import HelpSearch from '@ab/help/ui/HelpSearch.svelte';

export {
	type CalloutVariant,
	highlight,
	type InlineNode,
	MarkdownParseError,
	type MdNode,
	parseMarkdown,
	SHIKI_THEME,
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
export type {
	FilterKey,
	HelpRegistry,
	ParsedFilter,
	ParsedQuery,
	SearchFilters,
	SearchResult,
	SearchResultSet,
} from './schema/help-registry';
export type { HelpSection } from './schema/help-section';
export type { HelpTags } from './schema/help-tags';
export { listAviationReferences, search } from './search';
export { matchesFilters, rankBucket } from './search-core';
export {
	type HelpValidationIssue,
	type HelpValidationOptions,
	type HelpValidationResult,
	validateHelpPages,
} from './validation';
