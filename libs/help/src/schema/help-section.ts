/**
 * The `HelpSection` type -- one titled, collapsible chunk within a help page.
 *
 * Sections are ordered; the first section renders without a heading on the
 * page (it is the lede). Each section has a stable id that doubles as the
 * anchor target in the TOC.
 *
 * See `help-page.ts` for the enclosing `HelpPage` type.
 */

import type { HelpTags } from './help-tags';

export interface HelpSection {
	/** Stable id. Unique within the page. Used as anchor target. */
	id: string;
	/** Displayed heading. */
	title: string;
	/** Markdown body. May contain `[[display::id]]` wiki-links. */
	body: string;
	/**
	 * Optional section-level tag overrides. Missing axes inherit from the
	 * page tags. Use sparingly -- if a section has drastically different
	 * tags from its page, it probably belongs in its own page.
	 */
	tags?: Partial<HelpTags>;
	/**
	 * Related reference ids (aviation) or help page ids to render as
	 * "see also." Resolution is cross-registry: either target lib is fine.
	 */
	related?: readonly string[];
}
