/**
 * Phase 10 -- ASRS citation formatter.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `asrs` citation.
 *
 *   short   -> 'ASRS ACN 1234567'
 *   formal  -> 'NASA ASRS Report ACN 1234567'
 *   title   -> the report's narrative summary
 */
export function formatAsrsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for asrs entry: ${exhaustive as string}`);
		}
	}
}
