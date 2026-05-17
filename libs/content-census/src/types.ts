/**
 * `@ab/content-census` -- shared census types.
 *
 * Browser-safe: types only, no runtime values, no `node:*`, no `Buffer` /
 * `process`. The runtime barrel (`./index.ts`) re-exports these so a
 * `.svelte` component can `import type { CorpusCensus } from '@ab/content-census'`.
 *
 * The shapes here are the single output contract of every corpus adapter.
 * Heterogeneous corpora (markdown, JSON, TOML, DB rows) are all flattened
 * into one `CorpusCensus`; the dashboard renders that shape and nothing
 * else. See `docs/work-packages/hangar-content-census/design.md`.
 */

/** A link to a governing document -- an ADR, plan, spec, or source file. */
export interface DocLink {
	/** Human-readable label, e.g. "ADR 018 -- Source artifact storage". */
	label: string;
	/** Destination. A hangar `/docs/...` path, an in-app route, or an absolute URL. */
	href: string;
	/** What this document governs, in one short phrase. */
	role: string;
}

/**
 * Every metric carries its own explanation -- the explanatory-surface rule.
 * A bare number with no `whatItMeasures` / `whyItMatters` is a spec
 * violation and is rejected by the explanatory-rule guard test.
 */
export interface CensusMetric {
	/** Stable key, e.g. `generator-coverage`. */
	key: string;
	/** Display label, e.g. "Generator coverage". */
	label: string;
	/** The number or short string the metric reports. */
	value: number | string;
	/** Plain-language definition: what does this number actually measure? */
	whatItMeasures: string;
	/** The consequence: why does a reader care about this number? */
	whyItMatters: string;
	/** The action a reader can take, with an optional link to the WP/plan. */
	whatToDo?: { text: string; href?: string };
}

/** A gap -- something missing or thin in the corpus, fully explained. */
export interface CensusGap {
	/** Short title for the gap, e.g. "AIRMET / SIGMET examples cannot match". */
	title: string;
	/** What the gap is, in plain language. */
	whatItMeasures: string;
	/** Why the gap matters -- the pedagogical or product consequence. */
	whyItMatters: string;
	/** The concrete next action, with a link to the WP/plan that closes it. */
	whatToDo: { text: string; href?: string };
	/**
	 * `structural` -- a capability is missing entirely.
	 * `thin` -- content exists but is sparse.
	 * `nice-to-have` -- an enhancement, not a blocker.
	 */
	severity: 'structural' | 'thin' | 'nice-to-have';
}

/** Layer 2 -- authored intent, read from a content file's frontmatter. */
export interface ContentIntent {
	contentStatus: 'complete' | 'draft' | 'skeleton' | 'stub';
	/** Work the author has committed to doing. */
	planned: string[];
	/** Work the author would like but has not committed to. */
	wanted: string[];
	value: 'high' | 'standard' | 'low';
	notes?: string;
}

/** A single inventory item within a corpus. */
export interface CensusItem {
	/** Stable id, unique within the corpus. */
	id: string;
	/** Display label. */
	label: string;
	/**
	 * The Layer-1 derived state -- a corpus-specific string (e.g. `matched`,
	 * `skeleton`). The corpus's `stateRule` explains how it is computed.
	 */
	derivedState: string;
	/** Optional secondary detail shown alongside the item (e.g. the raw METAR). */
	detail?: string;
	/** Layer 2 intent, present once the corpus has authored frontmatter. */
	intent?: ContentIntent;
	/** Link to the item on its own surface, if it has one. */
	href?: string;
}

/** A synthesised "what to do next" entry, ranked by value. */
export interface CensusNextItem {
	/** What to do. */
	text: string;
	/** Why it is worth doing. */
	rationale: string;
	/** Link to the WP / plan / task that delivers it. */
	href?: string;
	/** Ranking weight -- `high` items sort first. */
	value: 'high' | 'standard' | 'low';
}

/**
 * The render mode of a corpus adapter.
 *
 * `full` -- a real reference adapter (wx-catalog in Phase 1): real
 *   inventory, real metrics, real gap view, real next-list.
 * `stub` -- the honest placeholder adapter (the other 13 corpora in
 *   Phase 1): the corpus name + location + a labelled "pending" state.
 *   It fabricates nothing except the explicit "pending" label.
 */
export type CensusMode = 'full' | 'stub';

/** A single managed-content corpus, fully described for the dashboard. */
export interface CorpusCensus {
	/** Stable id used in the route, e.g. `wx-catalog`. */
	id: string;
	/** Display label, e.g. "Encoded-text catalog". */
	label: string;
	/** One-line plain-language description of what the corpus is. */
	whatItIs: string;
	/** Why the corpus exists -- its purpose on the platform. */
	whyItExists: string;
	/** The path / glob the corpus lives at. */
	location: string;
	/** Render mode -- see {@link CensusMode}. */
	mode: CensusMode;
	/** The Layer-1 derived-state rule, stated in plain language. */
	stateRule: string;
	/** ADRs / plans / specs / sources that govern this corpus. */
	docs: DocLink[];
	/** The inventory. Empty for a stub corpus. */
	items: CensusItem[];
	/** Derived + explained metrics. Empty for a stub corpus. */
	metrics: CensusMetric[];
	/** Explained gaps. Empty for a stub corpus. */
	gaps: CensusGap[];
	/** Synthesised, value-ranked "what to do next". Empty for a stub corpus. */
	next: CensusNextItem[];
	/**
	 * Set only on a stub corpus: the honest "pending" message shown in place
	 * of real data, plus the link to the WP that tracks the real adapter.
	 */
	pending?: { message: string; href: string };
}

/** A row on the `/content` overview -- a corpus reduced to its headline facts. */
export interface CensusOverviewRow {
	id: string;
	label: string;
	whatItIs: string;
	mode: CensusMode;
	/** Item count, or `null` for a stub corpus (which must not fabricate one). */
	itemCount: number | null;
	/** Distribution of derived states, e.g. `[{ state: 'matched', count: 20 }]`. */
	stateDistribution: Array<{ state: string; count: number }>;
	/** A labelled, explained health signal -- never a bare colour. */
	health: CensusHealth;
	/** Count of captured planned-work items, or `null` until Layer 2 lands. */
	plannedWorkCount: number | null;
}

/** A labelled health signal with the rule that produced it spelled out. */
export interface CensusHealth {
	/** `healthy` | `attention` | `pending` -- the level. */
	level: 'healthy' | 'attention' | 'pending';
	/** Short label shown next to the level, e.g. "Needs attention". */
	label: string;
	/** The rule, verbatim -- shown in a tooltip so the signal is never opaque. */
	rule: string;
}
