/**
 * Phase 8 -- Advisory Circular citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2
 * (`CorpusResolver.formatCitation`).
 *
 * The three styles are precomputed at ingestion time and stored on the
 * `SourceEntry`; the formatter just picks the right field.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `ac` citation.
 *
 *   short   -> 'AC 61-65J' (or 'AC 61-65J Section 3', 'AC 61-65J Change 2')
 *   formal  -> 'FAA Advisory Circular 61-65J' (with optional Section/Change suffix)
 *   title   -> the AC's title (e.g. 'Certification: Pilots and Flight and Ground Instructors')
 */
export function formatAcCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for ac entry: ${exhaustive as string}`);
		}
	}
}
