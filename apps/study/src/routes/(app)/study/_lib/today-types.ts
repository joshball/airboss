/**
 * Discriminated union shapes for the Today briefing on `/study`.
 *
 * The loader builds a `TodayBriefing` value object from `getWeakAreas`,
 * `getNodeEvidenceStateMap`, and `getFirstTouchDate`. The pure helper
 * `renderTodayProse` consumes only this type -- no DB, no fetch, no
 * environment. That gives us deterministic rendering and exact-string
 * vitest assertions.
 */

import type { NodeEvidenceState } from '@ab/bc-study';

/** Source-of-weakness kind for the prose template's reason gating. */
export type TodayReasonKind = 'never_attempted' | 'low_accuracy' | 'overdue' | 'partial';

/** Assessment-method buckets the prose recognises. Mirror of `AssessmentMethod`. */
export type TodayReasonMethod = 'recall' | 'calculation' | 'scenario' | 'demonstration' | 'teaching';

/** One reason the focus leaf is the focus -- collapsed for prose generation. */
export interface TodayReason {
	kind: TodayReasonKind;
	/** Cards / scenarios accuracy as a 0..1 fraction. Present on `low_accuracy`. */
	accuracy?: number;
	/** Number of attempts the accuracy was computed over. Present on `low_accuracy`. */
	dataPoints?: number;
	/** Number of cards due-and-overdue on the focus node. Present on `overdue`. */
	dueCards?: number;
	/** Which assessment-method group the gap is on (`recall` / `scenario` / ...). Present on `low_accuracy`. */
	method?: TodayReasonMethod;
}

/**
 * Per-method percentages (0..100) for the partial-coverage prose. The
 * loader computes these from the focus leaf's required-kinds state plus
 * raw attempt counts; the prose helper formats them.
 *
 * `null` for methods that don't apply to this leaf -- distinct from `0`,
 * which means "applies but no progress yet."
 */
export interface TodayMethodPercentages {
	recall: number | null;
	calculation: number | null;
	scenario: number | null;
}

/** Single citation chip suitable for the Today prose CTA suffix. */
export interface TodayPrimaryCitation {
	kind: 'handbook' | 'reg';
	/** Display label, e.g. `'PHAK chapter 10'` or `'14 CFR 91.103'`. */
	label: string;
	/** Resolved href into the flightbag reader. */
	href: string;
}

/**
 * Briefing payload built by the loader. The page renders this through
 * `renderTodayProse`. Three shapes:
 *
 * - `'no-goal'`: user has no primary goal; the page renders a banner above
 *   the cert-agnostic tiles instead of a Today prose paragraph.
 * - `'caught_up'`: user has no weak areas; show a friendly nudge.
 * - `'focus'`: a specific leaf needs attention; render the templated paragraph.
 */
export type TodayBriefing =
	| { kind: 'no-goal' }
	| { kind: 'caught_up' }
	| {
			kind: 'focus';
			focusNodeId: string;
			focusNodeSlug: string;
			focusAreaId: string;
			leafTitle: string;
			areaTitle: string;
			pillState: NodeEvidenceState | null;
			/** Per-method coverage percentages, 0..100. Used by the partial-coverage prose. */
			methodPercentages: TodayMethodPercentages;
			reasons: readonly TodayReason[];
			primaryCitation: TodayPrimaryCitation | null;
			/** Days between the user's first touch on this node and `now`. Null when never touched. */
			dayCount: number | null;
	  };
