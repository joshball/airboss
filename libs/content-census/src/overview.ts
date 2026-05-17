/**
 * Pure census helpers -- browser-safe (no `node:*`, no `Buffer` / `process`).
 *
 * These reduce a `CorpusCensus` (produced server-side by an adapter) to the
 * `/content` overview row, and compute the explained health signal. They run
 * in the browser bundle, so they must stay free of filesystem / Node access.
 */

import type { CensusHealth, CensusOverviewRow, CorpusCensus } from './types';

/**
 * Build the derived-state distribution for a corpus -- the small bar shown on
 * the overview row. Counts are insertion-ordered by first appearance so the
 * bar is stable across loads.
 */
export function stateDistribution(census: CorpusCensus): Array<{ state: string; count: number }> {
	const counts = new Map<string, number>();
	for (const item of census.items) {
		counts.set(item.derivedState, (counts.get(item.derivedState) ?? 0) + 1);
	}
	return [...counts.entries()].map(([state, count]) => ({ state, count }));
}

/**
 * Compute the explained health signal for a corpus.
 *
 * The rule is deliberately simple and is surfaced verbatim in the UI tooltip
 * so the signal is never an opaque colour:
 *
 * - A stub corpus is `pending` -- it has no real adapter yet.
 * - A `census`-mode corpus is `surveyed` -- it has a real Layer-1 census but
 *   its gap view is Phase 3, so no structural-gap judgement can be made.
 * - A full corpus with one or more `structural` gaps is `attention`.
 * - Otherwise a full corpus is `healthy`.
 */
export function corpusHealth(census: CorpusCensus): CensusHealth {
	if (census.mode === 'stub') {
		return {
			level: 'pending',
			label: 'Census pending',
			rule: 'A real derived-state adapter for this corpus is deferred to Phase 2 of the content-census work package. No health can be computed until it lands.',
		};
	}
	if (census.mode === 'census') {
		return {
			level: 'surveyed',
			label: 'Layer 1 surveyed',
			rule: 'A real Layer-1 derived-state census exists for this corpus -- inventory, derived state, and explained metrics. Its gap view and authored intent (Layer 2) are deferred to Phase 3, so no structural-gap health judgement is made yet.',
		};
	}
	const structuralGaps = census.gaps.filter((gap) => gap.severity === 'structural').length;
	if (structuralGaps > 0) {
		return {
			level: 'attention',
			label: 'Needs attention',
			rule: `Health is "needs attention" when a corpus has one or more structural gaps -- a missing capability, not merely thin content. This corpus has ${structuralGaps}.`,
		};
	}
	return {
		level: 'healthy',
		label: 'Healthy',
		rule: 'Health is "healthy" when a full census adapter found no structural gaps -- every capability the corpus needs is present. Thin spots may still exist; see the drill-down gap view.',
	};
}

/** Count the planned-work items captured across a corpus's Layer-2 intent. */
export function plannedWorkCount(census: CorpusCensus): number | null {
	if (census.mode === 'stub') return null;
	let total = 0;
	let sawIntent = false;
	for (const item of census.items) {
		if (item.intent) {
			sawIntent = true;
			total += item.intent.planned.length;
		}
	}
	// No item carries an intent block yet -> Layer 2 is not authored for this
	// corpus. Report `null` ("--" in the UI), not a fabricated `0`.
	return sawIntent ? total : null;
}

/** Reduce a full `CorpusCensus` to the headline row shown on `/content`. */
export function toOverviewRow(census: CorpusCensus): CensusOverviewRow {
	return {
		id: census.id,
		label: census.label,
		whatItIs: census.whatItIs,
		mode: census.mode,
		itemCount: census.mode === 'stub' ? null : census.items.length,
		stateDistribution: census.mode === 'stub' ? [] : stateDistribution(census),
		health: corpusHealth(census),
		plannedWorkCount: plannedWorkCount(census),
	};
}
