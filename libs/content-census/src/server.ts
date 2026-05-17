// @browser-globals: server-only -- never imported by client .svelte
/**
 * `@ab/content-census/server` -- the server-only barrel.
 *
 * Every value exported here resolves to a module that reads the filesystem
 * (`node:fs`). `+page.server.ts`, scripts, and unit tests import from here;
 * `.svelte` files and non-server `.ts` files import the types + pure helpers
 * from `@ab/content-census` instead.
 *
 * The dispatch map below is the single place that wires a corpus id to its
 * adapter. wx-catalog has the FULL Phase-1 reference adapter; the Phase-2
 * adapters produce real Layer-1 censuses; any remaining corpus routes
 * through the honest stub adapter.
 */

import { stubCensus } from './adapters/_stub.server';
import { adrsCensus } from './adapters/adrs.server';
import { cardsCensus } from './adapters/cards.server';
import { knowledgeNodesCensus } from './adapters/knowledge-nodes.server';
import { regulationsCensus } from './adapters/regulations.server';
import { visionCensus } from './adapters/vision.server';
import { workPackagesCensus } from './adapters/work-packages.server';
import { wxCatalogCensus } from './adapters/wx-catalog.server';
import { CORPUS_REGISTRY, type CorpusDescriptor, type CorpusId } from './registry';
import type { CorpusCensus } from './types';

export { stubCensus } from './adapters/_stub.server';
export { adrsCensus } from './adapters/adrs.server';
export { cardsCensus } from './adapters/cards.server';
export { knowledgeNodesCensus } from './adapters/knowledge-nodes.server';
export { regulationsCensus } from './adapters/regulations.server';
export { repoRoot } from './adapters/repo-root.server';
export { visionCensus } from './adapters/vision.server';
export { workPackagesCensus } from './adapters/work-packages.server';
export { wxCatalogCensus } from './adapters/wx-catalog.server';

/** Look up the static descriptor for a corpus id. */
function descriptorFor(id: CorpusId): CorpusDescriptor {
	const descriptor = CORPUS_REGISTRY.find((corpus) => corpus.id === id);
	if (!descriptor) {
		throw new Error(`content-census: no registry descriptor for corpus "${id}"`);
	}
	return descriptor;
}

/**
 * The dispatch map: corpus id -> the adapter that produces its census.
 *
 * wx-catalog has the full Phase-1 reference adapter. The Phase-2 block
 * below wires the six markdown-corpus adapters -- knowledge nodes, cards,
 * regulations, vision, work packages, ADRs -- each a real Layer-1 census.
 * A corpus with no entry here routes through the honest stub adapter.
 */
const ADAPTERS: Partial<Record<CorpusId, () => CorpusCensus>> = {
	'wx-catalog': wxCatalogCensus,
	// Phase 2 -- markdown corpora (knowledge / cards / regulations / vision / WP / ADR).
	'knowledge-nodes': knowledgeNodesCensus,
	cards: cardsCensus,
	regulations: regulationsCensus,
	vision: visionCensus,
	'work-packages': workPackagesCensus,
	adrs: adrsCensus,
};

/**
 * Produce the `CorpusCensus` for a single corpus. A corpus with a wired
 * adapter gets its real census; every other corpus gets the honest stub.
 */
export function censusFor(id: CorpusId): CorpusCensus {
	const adapter = ADAPTERS[id];
	if (adapter) return adapter();
	return stubCensus(descriptorFor(id));
}

/** Produce the `CorpusCensus` for every registered corpus, in registry order. */
export function censusAll(): CorpusCensus[] {
	return CORPUS_REGISTRY.map((corpus) => censusFor(corpus.id));
}
