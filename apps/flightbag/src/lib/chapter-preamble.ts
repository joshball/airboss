/**
 * Chapter-preamble surfacing rule.
 *
 * The handbook + AC chapter readers each surface the chapter's depth-0 body
 * markdown (the "preamble") inline above the section list whenever the row
 * has any content -- body text, figures, or both. The FAA puts that intro
 * spread at the top of the print PDF chapter; the reader does the same.
 *
 * Pulled out of the inline `$derived` so a single function pins the rule
 * (and so phase-4 of WP-FLIGHTBAG-BOOK-EXPERIENCE has a unit-testable
 * surface that doesn't drift across corpora).
 */

export interface ChapterLike {
	readonly contentMd: string;
	readonly figures: ReadonlyArray<{ readonly id: string }>;
}

export function hasChapterPreamble(chapter: ChapterLike): boolean {
	return chapter.contentMd.trim().length > 0 || chapter.figures.length > 0;
}
