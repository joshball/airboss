/**
 * Phase 10 -- FAA Orders citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2
 * (`CorpusResolver.formatCitation`).
 *
 * The three styles are precomputed at ingestion time and stored on the
 * `SourceEntry`; the formatter just picks the right field. Phase 10 does
 * not yet ingest orders, so the registry has no entries -- when ingestion
 * lands the formatter will return real values without code changes here.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `orders` citation.
 *
 *   short   -> 'FAA Order 2150.3' (or 'FAA Order 8900.1, Vol 5 Ch 1', 'FAA Order 8260.3C 5.2.1')
 *   formal  -> 'FAA Order 2150.3, Compliance and Enforcement Program'
 *   title   -> the order's title (e.g. 'Compliance and Enforcement Program')
 */
export function formatOrdersCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for orders entry: ${exhaustive as string}`);
		}
	}
}
