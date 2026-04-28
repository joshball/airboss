/**
 * Public surface of the `scripts/sources/discover/` module.
 *
 * `runDiscoverErrata` is the dispatcher entry point. The remaining exports
 * are imported by tests and by sibling dispatcher modules (download
 * piggyback, server startup hook, dispatcher banner) -- keep them lean.
 */

export { ArgParseError, DISCOVER_HELP_TEXT, parseDiscoverArgs } from './args';
export {
	ALL_HANDBOOK_SLUGS,
	COMMON_ERRATA_TOKENS,
	getCatalogueEntry,
	HANDBOOK_CATALOGUE,
	type HandbookCatalogueEntry,
} from './catalogue';
export { isStale, lastRunPath, readLastRun, writeLastRun } from './freshness';
export { renderIssueBody } from './github';
export {
	pendingReportPath,
	renderPendingReport,
	unreviewedFrom,
	writePendingReport,
} from './pending';
export { parseMetaPayload, readPythonDiscoveryMeta } from './python-meta';
export { type RunDiscoverOptions, type RunDiscoverSummary, runDiscoverErrata } from './run';
export {
	classifyLayout,
	extractFindings,
	HandbookScrapeError,
	scrapeHandbookPage,
} from './scrape';
export {
	type DiscoveryCandidate,
	type DiscoveryState,
	emptyState,
	loadState,
	mergeScrapeResult,
	type ScrapeFinding,
	saveState,
	stateFilePath,
} from './state';
