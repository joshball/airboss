/**
 * Phase 10 -- Legal interpretations citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2
 * (`CorpusResolver.formatCitation`).
 *
 * The three styles are precomputed at ingestion time and stored on the
 * `SourceEntry`. Phase 10 first slice does not yet ingest interpretations;
 * when ingestion lands the formatter returns real values without code
 * changes here.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `interp` citation.
 *
 *   short   -> 'Mangiamele Letter (2009)' or 'Administrator v. Lobeiko'
 *   formal  -> 'FAA Chief Counsel Interpretation, Mangiamele (Apr. 2009)'
 *   title   -> the letter or case title
 */
export function formatInterpCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for interp entry: ${exhaustive as string}`);
		}
	}
}
