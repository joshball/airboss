/**
 * Phase 6 -- handbooks citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2
 * (`CorpusResolver.formatCitation`).
 *
 * The three styles are precomputed at ingestion time and stored on the
 * `SourceEntry`; the formatter just picks the right field. Token
 * substitution (`@cite`, `@list`, etc.) is the renderer's job in Phase 4.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `handbooks` citation.
 *
 *   short   -> 'PHAK Ch.12.3'                                         (or 'PHAK Ch.12', 'AFH Ch.5')
 *   formal  -> 'Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12, Section 3'
 *   title   -> 'Coriolis Force'                                       (the section's title)
 */
export function formatHandbooksCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for handbooks entry: ${exhaustive as string}`);
		}
	}
}
