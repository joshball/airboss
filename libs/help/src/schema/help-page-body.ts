/**
 * The `HelpPageBody` type -- the content half of a split help page.
 *
 * Body modules carry the heavy authoring fields (full section markdown +
 * external refs). They are dynamically imported on demand from `loadById`
 * + `/help/[id]` + the PageHelp drawer; never statically imported by
 * the always-loaded layout bundle.
 *
 * The pair `(HelpPageIndex, HelpPageBody)` reconstructs the original
 * `HelpPage` shape. The registry exposes `loadById(id)` which fetches the
 * body and returns a fully-merged `HelpPage`.
 */

import type { ExternalRef } from './external-ref';
import type { HelpSection } from './help-section';

export interface HelpPageBody {
	/** Stable id matching the index entry. */
	id: string;
	/**
	 * Ordered sections. First section renders without a heading on the
	 * detail page (the lede). Body markdown lives here.
	 */
	sections: readonly HelpSection[];
	/**
	 * External references rendered as a footer block. Required (>=1) for
	 * concept pages.
	 */
	externalRefs?: readonly ExternalRef[];
}
