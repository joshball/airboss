/**
 * The `HelpPage` type -- one app help page composed of ordered sections.
 *
 * Pages are authored as TypeScript data (TS wrapper + markdown `body` in each
 * section) so validation gates can run at build time and the authoring
 * surface stays plain-markdown in the common case. See the help-library
 * work-package design doc for the authoring shape.
 */

import type { ExternalRef } from './external-ref';
import type { HelpSection } from './help-section';
import type { HelpTags } from './help-tags';

export interface HelpPage {
	/** Stable id. Matches the URL slug. Unique within the registry. */
	id: string;

	/** Page title. Shown in TOC, nav, and search results. */
	title: string;

	/**
	 * One-line summary for search snippets + index cards. Plain text, no
	 * markdown.
	 */
	summary: string;

	/**
	 * Ordered sections. First section renders without a heading on the
	 * page (the lede).
	 */
	sections: readonly HelpSection[];

	/**
	 * Page-level tags. Every required axis must be present. Section-level
	 * overrides can refine individual axes without re-declaring the full
	 * bag.
	 */
	tags: HelpTags;

	/**
	 * The in-app route this page documents. When present, the detail page
	 * renders a "documents: /path" affordance. Must start with `/`.
	 */
	documents?: string;

	/**
	 * Related reference ids (aviation) or help page ids at the page level.
	 * Resolution is cross-registry.
	 */
	related?: readonly string[];

	/** Author attribution for hand-authored content. Optional. */
	author?: string;

	/**
	 * ISO-8601 date of the last human review. Drives the "stale help page"
	 * warning (>12 months).
	 */
	reviewedAt?: string;

	/**
	 * Internal: the appId that registered this page. Set by `registerPages`
	 * -- authors never set this.
	 */
	appId?: string;

	/**
	 * When true, the page is a concept page indexed under `/help/concepts`.
	 * Concept pages have richer editorial standards (externalRefs, cross-
	 * links, grouped index placement). Validator enforces `helpKind` === 'concept'
	 * when this flag is true.
	 */
	concept?: boolean;

	/**
	 * External references rendered as a footer block (like an academic
	 * paper's References section). Required (>=1) for concept pages.
	 */
	externalRefs?: readonly ExternalRef[];
}
