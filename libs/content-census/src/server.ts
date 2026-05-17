// @browser-globals: server-only -- never imported by client .svelte
/**
 * `@ab/content-census/server` -- the server-only barrel.
 *
 * Every value exported here resolves to a module that reads the filesystem
 * (`node:fs`) or the constant set. `+page.server.ts`, scripts, and unit tests
 * import from here; `.svelte` files and non-server `.ts` files import the
 * types + pure helpers from `@ab/content-census` instead.
 *
 * The dispatch map below is the single place that wires a corpus id to its
 * adapter. wx-catalog shipped the FULL Phase-1 reference adapter; Phase 2
 * adds real Layer-1 derived-state adapters for the remaining 13 corpora. Any
 * corpus id absent from `CENSUS_ADAPTERS` falls through to the honest stub.
 */

import { stubCensus } from './adapters/_stub.server';
import { acsCensus } from './adapters/acs.server';
import { adrsCensus } from './adapters/adrs.server';
import { cardsCensus } from './adapters/cards.server';
import { glossaryCensus } from './adapters/glossary.server';
import { handbooksCensus } from './adapters/handbooks.server';
import { knowledgeNodesCensus } from './adapters/knowledge-nodes.server';
import { regulationsCensus } from './adapters/regulations.server';
import { simContentCensus } from './adapters/sim-content.server';
import { sourcesCensus } from './adapters/sources.server';
import { visionCensus } from './adapters/vision.server';
import { workPackagesCensus } from './adapters/work-packages.server';
import { wxCatalogCensus } from './adapters/wx-catalog.server';
import { wxChartsCensus } from './adapters/wx-charts.server';
import { wxScenariosCensus } from './adapters/wx-scenarios.server';
import { CORPUS_REGISTRY, type CorpusDescriptor, type CorpusId } from './registry';
import type { CorpusCensus } from './types';

export { stubCensus } from './adapters/_stub.server';
export { acsCensus } from './adapters/acs.server';
export { adrsCensus } from './adapters/adrs.server';
export { cardsCensus } from './adapters/cards.server';
export { glossaryCensus } from './adapters/glossary.server';
export { handbooksCensus } from './adapters/handbooks.server';
export { knowledgeNodesCensus } from './adapters/knowledge-nodes.server';
export { regulationsCensus } from './adapters/regulations.server';
export { repoRoot } from './adapters/repo-root.server';
export { simContentCensus } from './adapters/sim-content.server';
export { sourcesCensus } from './adapters/sources.server';
export { visionCensus } from './adapters/vision.server';
export { workPackagesCensus } from './adapters/work-packages.server';
export { wxCatalogCensus } from './adapters/wx-catalog.server';
export { wxChartsCensus } from './adapters/wx-charts.server';
export { wxScenariosCensus } from './adapters/wx-scenarios.server';

/**
 * The dispatch map -- corpus id -> its real census adapter.
 *
 * A `Partial` record: a corpus id present here has a real adapter; an id
 * absent here falls through to `stubCensus`. Adding a corpus = one adapter
 * module + one entry here. The map keeps each contributor's wiring confined
 * to its own lines so parallel adapter work merges cleanly.
 *
 * wx-catalog has the full Phase-1 reference adapter. Phase 2 wires the
 * remaining 13 corpora -- the markdown corpora (knowledge nodes, cards,
 * regulations, vision, work packages, ADRs) and the registry / JSON /
 * code-based corpora (wx-scenarios, handbooks, ACS, sources, glossary,
 * wx-charts, sim-content) -- each a real Layer-1 census.
 */
const CENSUS_ADAPTERS: Partial<Record<CorpusId, () => CorpusCensus>> = {
	// Phase 1 -- the full reference adapter.
	'wx-catalog': wxCatalogCensus,
	// Phase 2 -- markdown corpora (knowledge / cards / regulations / vision / WP / ADR).
	'knowledge-nodes': knowledgeNodesCensus,
	cards: cardsCensus,
	regulations: regulationsCensus,
	vision: visionCensus,
	'work-packages': workPackagesCensus,
	adrs: adrsCensus,
	// Phase 2 -- registry / JSON / code-based corpora.
	'wx-scenarios': wxScenariosCensus,
	handbooks: handbooksCensus,
	acs: acsCensus,
	sources: sourcesCensus,
	glossary: glossaryCensus,
	'wx-charts': wxChartsCensus,
	'sim-content': simContentCensus,
};

/** Look up the static descriptor for a corpus id. */
function descriptorFor(id: CorpusId): CorpusDescriptor {
	const descriptor = CORPUS_REGISTRY.find((corpus) => corpus.id === id);
	if (!descriptor) {
		throw new Error(`content-census: no registry descriptor for corpus "${id}"`);
	}
	return descriptor;
}

/**
 * Produce the `CorpusCensus` for a single corpus. A corpus with a real
 * adapter wired into `CENSUS_ADAPTERS` gets it; every other corpus gets the
 * honest stub.
 */
export function censusFor(id: CorpusId): CorpusCensus {
	const adapter = CENSUS_ADAPTERS[id];
	if (adapter) return adapter();
	return stubCensus(descriptorFor(id));
}

/** Produce the `CorpusCensus` for every registered corpus, in registry order. */
export function censusAll(): CorpusCensus[] {
	return CORPUS_REGISTRY.map((corpus) => censusFor(corpus.id));
}
