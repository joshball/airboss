/**
 * Phase 10 -- POH/AFM citation formatter.
 *
 * Source of truth: ADR 019 §3.1, §2.2.
 *
 * Three styles are precomputed at ingestion time and stored on the
 * `SourceEntry`. Phase 10 first slice does not yet ingest POHs.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `pohs` citation.
 *
 *   short   -> 'C172S POH §2' or 'PA-28-181 POH'
 *   formal  -> 'Cessna 172S Skyhawk Pilot Operating Handbook, Section 2'
 *   title   -> the document's full title
 */
export function formatPohsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for pohs entry: ${exhaustive as string}`);
		}
	}
}
