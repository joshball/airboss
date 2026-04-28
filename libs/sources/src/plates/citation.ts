/**
 * Phase 10 -- Plates citation formatter.
 *
 * Source of truth: ADR 019 §3.1, §2.2.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `plates` citation.
 *
 *   short   -> 'KAPA ILS RWY 35R'
 *   formal  -> 'KAPA Instrument Approach Procedure: ILS RWY 35R, FAA dTPP'
 *   title   -> the plate's full TPP title
 */
export function formatPlatesCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for plates entry: ${exhaustive as string}`);
		}
	}
}
