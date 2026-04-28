/**
 * PTS citation formatter. Mirrors the ACS formatter shape: three
 * pre-computed styles (canonical_short, canonical_formal, canonical_title)
 * live on `SourceEntry`; the formatter just picks one.
 *
 *   short   -> 'CFII PTS V.A.1'
 *   formal  -> 'Flight Instructor Instrument PTS (FAA-S-8081-9E), Area V Task A Objective 1'
 *   title   -> 'Aerodynamics of holding patterns'
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

export function formatPtsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for pts entry: ${exhaustive as string}`);
		}
	}
}
