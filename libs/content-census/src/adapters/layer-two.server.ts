// @browser-globals: server-only -- never imported by client .svelte
/**
 * The Layer-2 placeholder for `census`-mode adapters.
 *
 * A Phase-2 adapter ships a real Layer-1 derived-state census: real
 * inventory, real derived state, real explained metrics. Its gap view and
 * authored-intent view (Layer 2) are deferred to Phase 3 of the
 * content-census work package.
 *
 * Rather than fabricate gaps, a `census`-mode `CorpusCensus` carries a
 * `layerTwoPending` block: an explicit, labelled message plus a link to the
 * Phase-3 tasks. This is a spec-mandated placeholder (design.md "Placeholder
 * honesty"), not a code shortcut -- the gaps array stays genuinely empty.
 */

import { ROUTES } from '@ab/constants';

/** Workspace-relative path to the content-census tasks file. */
const CENSUS_TASKS_PATH = 'docs/work-packages/hangar-content-census/tasks.md';

/**
 * Build the labelled Layer-2 placeholder for a `census`-mode corpus. The
 * `corpusLabel` is woven into the message so the placeholder reads naturally
 * on each drill-down page.
 */
export function layerTwoPending(corpusLabel: string): { message: string; href: string } {
	return {
		message:
			`This corpus has a real Layer-1 census above -- inventory, derived state, and explained metrics. ` +
			`Its gap view and authored-intent view (Layer 2) are deferred to Phase 3 of the content-census work ` +
			`package, which authors the content-intent frontmatter and the per-corpus gap analysis for "${corpusLabel}". ` +
			`No gaps are shown here because they would be fabricated rather than measured until that analysis is authored.`,
		href: ROUTES.HANGAR_DOCS_PATH(CENSUS_TASKS_PATH),
	};
}
