/**
 * The `HelpPageIndex` type -- the navigation/search-time view of a help page.
 *
 * Indices ship with the always-loaded help bundle: every signed-in route
 * needs to know which help pages exist (for the `/help` landing page, the
 * search palette, the InfoTip resolver, and PageHelp's "does this id
 * exist?" guard) but only `/help/[id]` and the PageHelp drawer need the
 * full body markdown + external refs. Bodies load via dynamic `import()`
 * keyed by id when those surfaces actually open.
 *
 * The shape mirrors `HelpPage` minus the heavy fields (`sections.body`,
 * `externalRefs`) and adds `searchHaystack` -- a pre-lowercased blob of
 * summary + section bodies + keywords concatenated with spaces. The
 * registry's search keyword/body bucket scans this string instead of
 * walking the section tree per keystroke.
 *
 * `sections` here carries titles + ids only (so the TOC sidebar can render
 * before the body resolves) but no `body` field. Authoring tools may use
 * `derivedFromBody` to hint that the index is generated from a body file
 * rather than hand-authored.
 */

import type { ExternalRef } from './external-ref';
import type { HelpTags } from './help-tags';

export interface HelpSectionIndex {
	/** Stable section id. Used as anchor target. Matches the body section id. */
	id: string;
	/** Displayed heading. Same string the body file uses. */
	title: string;
}

export interface HelpPageIndex {
	/** Stable id. Matches the URL slug. Unique within the registry. */
	id: string;

	/** Page title. Shown in TOC, nav, and search results. */
	title: string;

	/** One-line summary for search snippets + index cards. Plain text. */
	summary: string;

	/**
	 * Ordered section index entries. First section renders without a heading
	 * on the detail page (the lede). Bodies live in the body module.
	 */
	sections: readonly HelpSectionIndex[];

	/**
	 * Pre-lowercased haystack: summary + every section body + keywords joined
	 * with spaces. Search ranks against this string instead of allocating per
	 * keystroke. Authored once at index-build time; kept in sync with the
	 * body module by the index generator.
	 */
	searchHaystack: string;

	/** Page-level tags. Required axes must be present. */
	tags: HelpTags;

	/** In-app route this page documents. When present, detail page links. */
	documents?: string;

	/** Related reference / help ids. Resolution is cross-registry. */
	related?: readonly string[];

	/** Author attribution. Optional. */
	author?: string;

	/** ISO-8601 date of last human review. Drives stale-help warning. */
	reviewedAt?: string;

	/** Internal: appId set by `registerIndex`. Authors never set this. */
	appId?: string;

	/** Concept-page flag. See `HelpPage.concept`. */
	concept?: boolean;

	/**
	 * Optional preview of external refs surfaced by index consumers (e.g. a
	 * card on `/help/concepts` that hints at the source set without forcing
	 * a body fetch). Optional; full set lives in the body module.
	 */
	externalRefs?: readonly ExternalRef[];
}
