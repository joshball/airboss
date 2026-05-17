/**
 * The corpus registry -- the canonical list of all 14 managed-content
 * corpora, in the order spec.md's corpus table defines them.
 *
 * Browser-safe: descriptors only (id, label, location, the WP phase that
 * delivers the real adapter). The adapter *functions* live in
 * `./adapters/*.server.ts` and are wired in `./server.ts` -- importing them
 * here would pull `node:fs` into the browser bundle.
 *
 * Adding a corpus = one descriptor here + one adapter module + one line in
 * `./server.ts`'s dispatch map.
 */

/** A static description of a corpus -- no derived data, browser-safe. */
export interface CorpusDescriptor {
	/** Stable id used in the `/content/[corpus]` route. */
	id: string;
	/** Display label. */
	label: string;
	/** The path / glob the corpus lives at. */
	location: string;
	/** One-line plain-language description. */
	whatItIs: string;
	/**
	 * `1` -- a real adapter ships in Phase 1 (wx-catalog only).
	 * `2` -- a real Layer-1 adapter is deferred to Phase 2 (the other 13).
	 */
	adapterPhase: 1 | 2;
}

/**
 * All 14 corpora from spec.md's "Census scope" table. The `id` values are
 * the route segments; `wx-catalog` is the Phase-1 reference adapter and the
 * other 13 render through the placeholder stub adapter until Phase 2.
 */
export const CORPUS_REGISTRY = [
	{
		id: 'knowledge-nodes',
		label: 'Knowledge nodes',
		location: 'course/knowledge/**',
		whatItIs: 'Atomic ADR-011 learning nodes -- the discovery-first knowledge graph.',
		adapterPhase: 2,
	},
	{
		id: 'cards',
		label: 'Cards (spaced-rep)',
		location: ':::cards blocks in node markdown',
		whatItIs: 'Spaced-repetition cards embedded across knowledge-node markdown.',
		adapterPhase: 2,
	},
	{
		id: 'wx-catalog',
		label: 'Encoded-text catalog',
		location: 'course/knowledge/weather/encoded-text-catalog/',
		whatItIs: 'A coverage matrix of every realistic METAR / TAF / PIREP / FB / AIRMET shape.',
		adapterPhase: 1,
	},
	{
		id: 'wx-scenarios',
		label: 'wx-engine scenarios',
		location: 'libs/wx-engine/src/truth/scenarios/',
		whatItIs: 'Authored truth-model scenarios that drive the wx-engine generators.',
		adapterPhase: 2,
	},
	{
		id: 'regulations',
		label: 'Regulations course',
		location: 'course/regulations/**',
		whatItIs: 'The structured FAR navigation course -- a walk through Parts 1 / 61 / 91 / 141 / 135.',
		adapterPhase: 2,
	},
	{
		id: 'handbooks',
		label: 'Handbooks',
		location: 'handbooks/**',
		whatItIs: 'Ingested FAA handbook sections (PHAK, AFH, IFH, and more).',
		adapterPhase: 2,
	},
	{
		id: 'acs',
		label: 'ACS documents',
		location: 'acs/**',
		whatItIs: 'Airman Certification Standards documents -- the checkride task tables.',
		adapterPhase: 2,
	},
	{
		id: 'sources',
		label: 'Source registry',
		location: 'ac/, info/, safo/ + libs/sources/',
		whatItIs: 'The canonical FAA source-document registry -- ACs, InFOs, SAFOs.',
		adapterPhase: 2,
	},
	{
		id: 'glossary',
		label: 'Help library + glossary',
		location: 'libs/help/, libs/db/seed/glossary.toml',
		whatItIs: 'The page-help library and the aviation-term glossary.',
		adapterPhase: 2,
	},
	{
		id: 'vision',
		label: 'Vision / PRD docs',
		location: 'docs/vision/**',
		whatItIs: 'Product vision documents and PRDs across the 53-product index.',
		adapterPhase: 2,
	},
	{
		id: 'work-packages',
		label: 'Work packages',
		location: 'docs/work-packages/**',
		whatItIs: 'Feature work packages -- process metadata also surfaced on /roadmap.',
		adapterPhase: 2,
	},
	{
		id: 'adrs',
		label: 'ADRs',
		location: 'docs/decisions/**',
		whatItIs: 'Architecture decision records -- process metadata also surfaced on /roadmap.',
		adapterPhase: 2,
	},
	{
		id: 'wx-charts',
		label: 'wx charts / symbology',
		location: 'libs/wx-charts/',
		whatItIs: 'Weather-chart renderers and the aviation symbology library.',
		adapterPhase: 2,
	},
	{
		id: 'sim-content',
		label: 'Sim scenarios / models',
		location: 'libs/bc/sim/, apps/sim/',
		whatItIs: 'Decision-rep micro-scenarios and flight-sim physics models.',
		adapterPhase: 2,
	},
] as const satisfies readonly CorpusDescriptor[];

/** The id of every registered corpus, in registry order. */
export type CorpusId = (typeof CORPUS_REGISTRY)[number]['id'];

/** All corpus ids, in registry order -- useful for iteration and route guards. */
export const CORPUS_IDS: readonly CorpusId[] = CORPUS_REGISTRY.map((corpus) => corpus.id);
