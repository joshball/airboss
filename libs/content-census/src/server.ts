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
 * adapter. wx-catalog has the FULL Phase-1 reference adapter; the other 13
 * corpora route through the honest stub adapter until Phase 2.
 */

import { CORPUS_REGISTRY, type CorpusDescriptor, type CorpusId } from './registry';
import type { CorpusCensus } from './types';
import { stubCensus } from './adapters/_stub.server';
import { wxCatalogCensus } from './adapters/wx-catalog.server';

export { wxCatalogCensus } from './adapters/wx-catalog.server';
export { stubCensus } from './adapters/_stub.server';
export { repoRoot } from './adapters/repo-root.server';

/** Look up the static descriptor for a corpus id. */
function descriptorFor(id: CorpusId): CorpusDescriptor {
	const descriptor = CORPUS_REGISTRY.find((corpus) => corpus.id === id);
	if (!descriptor) {
		throw new Error(`content-census: no registry descriptor for corpus "${id}"`);
	}
	return descriptor;
}

/**
 * Produce the `CorpusCensus` for a single corpus. wx-catalog gets its full
 * reference adapter; every other corpus gets the honest stub.
 */
export function censusFor(id: CorpusId): CorpusCensus {
	if (id === 'wx-catalog') return wxCatalogCensus();
	return stubCensus(descriptorFor(id));
}

/** Produce the `CorpusCensus` for every registered corpus, in registry order. */
export function censusAll(): CorpusCensus[] {
	return CORPUS_REGISTRY.map((corpus) => censusFor(corpus.id));
}
