/**
 * Common rendering shape for the cert map's three projections (ACS,
 * Handbook, Course). `MapTree.svelte` recurses over `MapNode[]` without
 * caring which projection produced it; per-projection logic lives in
 * the three loader helpers (`buildAcsTree`, `buildHandbookTree`,
 * `buildCourseTree`).
 */

import type { NodeEvidenceState } from '@ab/bc-study';
import type { CitationOrder, StudyMapTab } from '@ab/constants';

export type { CitationOrder, StudyMapTab };
export type MapTab = StudyMapTab;

/** Coarse position of a node within the projection tree. */
export type MapNodeLevel = 'group' | 'subgroup' | 'leaf';

/**
 * Per-leaf citation chip (handbook section, regulation, AC). The loader
 * resolves `href` via `urlForReference()` so the chip is a plain link.
 */
export interface MapCitationChip {
	id: string;
	label: string;
	href: string;
	source: 'handbook' | 'regulation' | 'ac';
}

export interface MapCitationStacks {
	handbook: readonly MapCitationChip[];
	regulation: readonly MapCitationChip[];
}

/**
 * Cumulative mastery over the leaves below this node. `coveredLeaves`
 * is the count with any evidence attempted, `masteredLeaves` is the
 * count with every required-kind gate passing. `null` for nodes whose
 * children don't have a mastery axis (e.g. a pure-reading lesson).
 */
export interface MapRollup {
	masteredLeaves: number;
	coveredLeaves: number;
	totalLeaves: number;
}

export interface MapNode {
	id: string;
	label: string;
	level: MapNodeLevel;
	/** Optional secondary label rendered after the title (e.g. ACS code or PHAK chapter number). */
	code?: string;
	rollup: MapRollup | null;
	/** Required-kinds-aware glyph state for the leaf row's left-column status mark. */
	pills?: NodeEvidenceState | null;
	/** Per-leaf required-kind set; lets the renderer mark non-required pills as `--`. */
	requiredKinds?: readonly ('recall' | 'calculation' | 'scenario' | 'demonstration' | 'teaching')[];
	/** Citation chips attached to the leaf. Empty stacks render a "no citations" hint, not a chip row. */
	citations?: MapCitationStacks;
	/** Optional drill-down link (e.g. handbook chapter -> flightbag reader). Leaves usually link to their knowledge node. */
	href?: string;
	/** Server-set initial expansion state. Used by the auto-expand-focus-area behavior. */
	defaultOpen?: boolean;
	/** Optional "(reading)" / "(pending review)" badge text rendered inline after the label. */
	badge?: string;
	children: readonly MapNode[];
}
