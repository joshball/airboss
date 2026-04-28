/**
 * Phase 10 -- Forms citation formatter.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `forms` citation.
 *
 *   short   -> 'FAA Form 8710-1'
 *   formal  -> 'FAA Form 8710-1, Airman Certificate and/or Rating Application'
 *   title   -> the form's full title
 */
export function formatFormsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for forms entry: ${exhaustive as string}`);
		}
	}
}
