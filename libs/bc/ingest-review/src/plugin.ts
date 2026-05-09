/**
 * Plugin registry + lookup helpers.
 *
 * One module-level `Map` keyed on the plugin's `kind`. Plugins register
 * themselves as a side effect of importing `./plugins/index.ts`; the
 * server barrel does the import once on cold start so every consumer
 * sees the same registry.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 *
 * (Type re-exports of `IngestIssuePlugin` etc. live in `./index.ts` and
 * are erased at compile time, so the runtime barrel does not pull this
 * module's value chain into the browser bundle.)
 */

import type { IngestIssueKind } from '@ab/constants';
import type { IngestIssuePlugin } from './types';

export class PluginAlreadyRegisteredError extends Error {
	readonly code = 'INGEST_PLUGIN_ALREADY_REGISTERED';
	constructor(public readonly kind: IngestIssueKind) {
		super(`ingest-review plugin already registered for kind '${kind}'`);
		this.name = 'PluginAlreadyRegisteredError';
	}
}

export class UnknownPluginKindError extends Error {
	readonly code = 'INGEST_UNKNOWN_PLUGIN_KIND';
	constructor(public readonly kind: string) {
		super(`no ingest-review plugin registered for kind '${kind}'`);
		this.name = 'UnknownPluginKindError';
	}
}

export type IngestIssuePluginRegistry = ReadonlyMap<IngestIssueKind, IngestIssuePlugin>;

const registry = new Map<IngestIssueKind, IngestIssuePlugin>();
const insertionOrder: IngestIssueKind[] = [];

/**
 * Register one plugin. Throws if a plugin is already registered for the
 * same kind -- silent overwrite would let two plugins fight over the same
 * action handler with no warning.
 */
export function registerPlugin<P, A>(plugin: IngestIssuePlugin<P, A>): void {
	if (registry.has(plugin.kind)) throw new PluginAlreadyRegisteredError(plugin.kind);
	// Cast widens to the registry's `Record<string, unknown>` shape; the
	// generic types are recovered at the consumer's typed `getPlugin<P, A>`.
	registry.set(plugin.kind, plugin as IngestIssuePlugin);
	insertionOrder.push(plugin.kind);
}

/**
 * Look up the plugin for `kind`. Throws on miss so the route handler
 * gets a typed error instead of `undefined.applyAction is not a function`.
 */
export function getPlugin<P = Record<string, unknown>, A = Record<string, unknown>>(
	kind: IngestIssueKind | string,
): IngestIssuePlugin<P, A> {
	const plugin = registry.get(kind as IngestIssueKind);
	if (!plugin) throw new UnknownPluginKindError(kind);
	return plugin as unknown as IngestIssuePlugin<P, A>;
}

/**
 * List every registered plugin in registration order. Used by the
 * producer pipeline to walk every plugin scoped to a corpus.
 */
export function listPlugins(): readonly IngestIssuePlugin[] {
	const out: IngestIssuePlugin[] = [];
	for (const kind of insertionOrder) {
		const plugin = registry.get(kind);
		if (plugin) out.push(plugin);
	}
	return out;
}

/**
 * Distinct kinds in registration order. Useful for filter chips and tests.
 */
export function listPluginKinds(): readonly IngestIssueKind[] {
	return insertionOrder.slice();
}

/**
 * Test-only reset hook. Production never calls this.
 */
export function resetPluginRegistry(): void {
	registry.clear();
	insertionOrder.length = 0;
}
