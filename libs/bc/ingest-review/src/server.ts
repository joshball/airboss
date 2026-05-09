/**
 * Ingest-Review BC -- server-only barrel.
 *
 * Every value here resolves to a module that imports `@ab/db/connection`
 * (which loads the `postgres` driver). Re-exporting these from `./index.ts`
 * would drag postgres into the browser bundle. Consumers reach this file
 * via `@ab/bc-ingest-review/server`.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

// Side-effect import: registers every plugin in the global registry on
// cold start. Doing this from the server barrel guarantees the registry
// is populated before any DB-touching consumer dispatches by kind.
import './plugins';

// Re-export the runtime-safe surface so server consumers only import once.
export * from './index';
export {
	getPlugin,
	type IngestIssuePluginRegistry,
	listPluginKinds,
	listPlugins,
	PluginAlreadyRegisteredError,
	registerPlugin,
	resetPluginRegistry,
	UnknownPluginKindError,
} from './plugin';
export { registerAllPlugins } from './plugins';
// Handbook edition discovery -- exposed for the import-overrides script
// so it can resolve a slug -> edition without re-implementing the walk.
export { type HandbookEdition, listHandbookEditions } from './plugins/handbook-shared';
export { type ProducerOptions, type ProducerSummary, runProducers } from './producer';
// Server-only value exports.
export {
	type ApplyOverrideInput,
	applyOverride,
	dismissIssue,
	getCurrentOverride,
	getCurrentOverrides,
	getIssue,
	getStatusCounts,
	InvalidActionPayloadError,
	IssueNotFoundError,
	type ListIssuesFilters,
	listIssues,
	listOverridesWithIssues,
	listSources,
	markStaleByDifference,
	reopenIssue,
	upsertIssue,
	upsertIssues,
} from './queries';
