/**
 * Help-content tag taxonomy, typed.
 *
 * Mirrors the `ReferenceTags` shape from `@ab/aviation` but with help-specific
 * axes (`appSurface`, `helpKind`). The closed-enum values themselves live in
 * `@ab/constants/help-tags`; this module exports the TypeScript view the
 * registry + validator + UI consume.
 *
 * `aviationTopic` from `@ab/aviation` is deliberately allowed on help pages
 * that happen to cover aviation content (a help page about weather minimums
 * in the reps-session context, for instance). The search facade can then
 * de-dupe axes across both libraries.
 */

import type { AppSurface, AviationTopic, ConceptGroup, HelpKind } from '@ab/constants';

/**
 * The full tag bag on a help page or section.
 */
export interface HelpTags {
	/**
	 * Required. Multi-valued (1-3). Which surface(s) this page documents.
	 * Drives the `appSurface` facet. First entry is the primary surface
	 * used for grouping the /help index.
	 */
	appSurface: readonly AppSurface[];

	/** Required. Single-valued. What kind of help this page is. */
	helpKind: HelpKind;

	/**
	 * Optional. Reuses the aviation-topic axis so a help page that covers
	 * aviation content gets surfaced by aviation-topic filters too.
	 */
	aviationTopic?: readonly AviationTopic[];

	/**
	 * Optional. Freeform synonyms, misspellings, alternate phrasings. Same
	 * length + count caps as reference keywords.
	 */
	keywords?: readonly string[];

	/**
	 * Optional. Grouping axis for the `/help/concepts` index. Only meaningful
	 * when the parent page has `concept === true`; the concepts route groups
	 * pages by this value. Pages without a group fall into the
	 * `airboss-architecture` bucket.
	 */
	conceptGroup?: ConceptGroup;
}
