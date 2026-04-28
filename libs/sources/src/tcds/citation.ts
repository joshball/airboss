/**
 * Phase 10 -- TCDS citation formatter.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `tcds` citation.
 *
 *   short   -> 'TCDS 3A12'
 *   formal  -> 'FAA Type Certificate Data Sheet 3A12, Cessna 172 Series'
 *   title   -> the type's full name
 */
export function formatTcdsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for tcds entry: ${exhaustive as string}`);
		}
	}
}
