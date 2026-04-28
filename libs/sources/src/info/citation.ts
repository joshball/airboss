/**
 * Phase 10 -- InFO citation formatter.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `info` citation.
 *
 *   short   -> 'InFO 21010'
 *   formal  -> 'FAA Information for Operators 21010 (Aug. 2021)'
 *   title   -> the InFO's subject title
 */
export function formatInfoCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for info entry: ${exhaustive as string}`);
		}
	}
}
