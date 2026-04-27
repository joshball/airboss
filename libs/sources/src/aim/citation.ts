/**
 * Phase 7 -- AIM citation formatter.
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
 * Format an `aim` citation.
 *
 *   short   -> 'AIM 5-1-7'                                                       (or 'AIM 5-1', 'AIM 5', 'AIM Glossary - Pilot In Command', 'AIM Appendix 1')
 *   formal  -> 'Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7'
 *   title   -> 'Pilot Responsibility upon Clearance Issuance'                    (the entry's title)
 */
export function formatAimCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for aim entry: ${exhaustive as string}`);
		}
	}
}
