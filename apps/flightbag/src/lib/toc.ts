/**
 * Helper to map a `ReadingOrderEntry[]` from the BC into the shape
 * `<TOCDrawer>` consumes.
 *
 * Each route loader supplies its corpus-specific `hrefFor(entry)` that
 * resolves a section to a flightbag URL (or null when the row has no
 * dedicated reader page -- e.g. a CFR subpart container). Entries with
 * `null` href stay in the list so the user can see them, but render as
 * plain text.
 */

import type { ReadingOrderEntry } from '@ab/bc-study/server';
import { readingMinutesForWords } from '@ab/constants';
import type { TOCDrawerEntry } from '@ab/library';

export type TOCHrefFn = (entry: ReadingOrderEntry) => string | null;

/**
 * Build the TOC payload the drawer renders.
 *
 * @param order   reading-order entries from `computeReadingOrder` /
 *                `getReadingOrder`
 * @param activeSectionId  the id of the section the user is currently on, or
 *                null when on a doc-level / chapter-level page that doesn't
 *                map to a single section
 * @param hrefFor route-specific href resolver
 */
export function buildTOCEntries(
	order: ReadonlyArray<ReadingOrderEntry>,
	activeSectionId: string | null,
	hrefFor: TOCHrefFn,
): TOCDrawerEntry[] {
	return order.map((entry) => ({
		sectionId: entry.sectionId,
		code: entry.code,
		title: entry.title,
		depth: entry.depth,
		href: hrefFor(entry),
		minutesToRead: readingMinutesForWords(entry.wordCount),
		isActive: entry.sectionId === activeSectionId,
	}));
}

/** Sum of reading-time minutes across the whole reading order. */
export function totalReadingMinutes(order: ReadonlyArray<ReadingOrderEntry>): number {
	let acc = 0;
	for (const e of order) acc += readingMinutesForWords(e.wordCount);
	return acc;
}
