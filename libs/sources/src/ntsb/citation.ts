/**
 * Phase 10 -- NTSB citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2
 * (`CorpusResolver.formatCitation`).
 *
 * The three styles are precomputed at ingestion time and stored on the
 * `SourceEntry`; the formatter just picks the right field. Phase 10 does
 * not yet ingest NTSB reports, so the registry has no entries -- when
 * ingestion lands the formatter will return real values without code
 * changes here.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `ntsb` citation.
 *
 *   short   -> 'NTSB WPR23LA123' (or 'NTSB WPR23LA123 (Probable Cause)')
 *   formal  -> 'NTSB Aviation Accident Report WPR23LA123'
 *   title   -> the report's narrative title (per the canonical_title field)
 */
export function formatNtsbCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for ntsb entry: ${exhaustive as string}`);
		}
	}
}
