// @browser-globals: server-only -- never imported by client .svelte
/**
 * The honest placeholder adapter.
 *
 * Used for the 13 corpora whose real derived-state adapter is deferred to
 * Phase 2 of the content-census work package. It returns the corpus's real
 * name and real location, and an explicit, labelled "drill-down pending"
 * state with a link to the WP.
 *
 * It MUST NOT fabricate counts or fake derived states: empty `items`, empty
 * `metrics`, empty `gaps`, empty `next`. The only allowed fabrication is the
 * explicit `pending` label -- that is a deliberate, spec-mandated honest
 * placeholder, not a code shortcut. A placeholder that looks like real data
 * is a spec violation (design.md "Placeholder honesty").
 */

import { ROUTES } from '@ab/constants';
import type { CorpusDescriptor } from '../registry';
import type { CorpusCensus } from '../types';

const CENSUS_WP_PATH = 'docs/work-packages/hangar-content-census/tasks.md';

/**
 * Build the honest stub census for a corpus that has no real adapter yet.
 * Reads nothing -- there is no data to read until the Phase-2 adapter exists.
 */
export function stubCensus(descriptor: CorpusDescriptor): CorpusCensus {
	return {
		id: descriptor.id,
		label: descriptor.label,
		whatItIs: descriptor.whatItIs,
		whyItExists:
			'This corpus is part of the platform content scope. A real derived-state census adapter for it is staged for Phase 2 of the content-census work package.',
		location: descriptor.location,
		mode: 'stub',
		stateRule:
			'No derived-state rule is computed yet -- the Phase-2 adapter defines it. This corpus currently renders as an honest placeholder.',
		docs: [
			{
				label: 'Content census -- Phase 2 tasks',
				href: ROUTES.HANGAR_DOCS_PATH(CENSUS_WP_PATH),
				role: 'Tracks the real derived-state adapter for this corpus.',
			},
		],
		items: [],
		metrics: [],
		gaps: [],
		next: [],
		pending: {
			message: `Drill-down pending (Phase 2). A real census adapter for "${descriptor.label}" is staged but not yet built. No counts or states are shown for this corpus because fabricating them would be dishonest.`,
			href: ROUTES.HANGAR_DOCS_PATH(CENSUS_WP_PATH),
		},
	};
}
