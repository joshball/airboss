/**
 * Ingest-Review BC -- runtime / browser-safe barrel.
 *
 * Reachable from `.svelte` files and any client-bundled SvelteKit module.
 * Every value re-export here resolves to a module that does NOT statically
 * import `@ab/db/connection`. Server-only value exports live in
 * `./server.ts`, exposed at `@ab/bc-ingest-review/server`. The types of
 * server-only modules can still be re-exported here as `export type`
 * because TypeScript erases type re-exports at compile time.
 *
 * See `docs/agents/debug-playbooks/browser-hydration.md` for why this
 * split is load-bearing.
 */

export type {
	IngestIssuePluginRegistry,
	PluginAlreadyRegisteredError,
	UnknownPluginKindError,
} from './plugin';
export type { ProducerOptions, ProducerSummary } from './producer';
// Type-only re-exports of the server-only modules. TypeScript erases
// these so importers can keep `import type { ... } from '@ab/bc-ingest-review'`
// in `.svelte` files without dragging the postgres driver into the
// browser bundle.
export type { ApplyOverrideInput, ListIssuesFilters } from './queries';
// Drizzle table objects + row types. `pg-core` is browser-safe (it's a
// SQL builder; the postgres driver lives in `@ab/db/connection`).
export type { IngestIssueRow, IngestOverrideRow, NewIngestIssueRow, NewIngestOverrideRow } from './schema';
export { ingestIssue, ingestOverride } from './schema';
// Public type surface. All pure types -- safe in any module.
export type {
	ActionContext,
	ActionInput,
	Candidate,
	CandidateContext,
	CaptionOrphanPairPayload,
	HandbookCaptionCandidate,
	HandbookCaptionOrphanPayload,
	HandbookFigureCandidate,
	HandbookImageOrphanPayload,
	ImageOrphanPairPayload,
	IngestIssuePlugin,
	IssueInput,
	IssueRecord,
	OverrideRecord,
	ProducerContext,
	YamlSidecar,
	YamlSidecarEntry,
} from './types';
