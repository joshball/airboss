/**
 * Phase 10 -- SAFO citation formatter.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `safo` citation.
 *
 *   short   -> 'SAFO 23004'
 *   formal  -> 'FAA Safety Alert for Operators 23004 (Mar. 2023)'
 *   title   -> the SAFO's subject title
 */
export function formatSafoCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for safo entry: ${exhaustive as string}`);
		}
	}
}
