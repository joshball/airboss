/**
 * Phase 10 -- Statutes citation formatter.
 *
 * Source of truth: ADR 019 §3.1, §2.2.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `statutes` citation.
 *
 *   short   -> '49 U.S.C. § 40103'
 *   formal  -> '49 U.S.C. § 40103, Sovereignty and use of airspace'
 *   title   -> the section heading
 */
export function formatStatutesCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for statutes entry: ${exhaustive as string}`);
		}
	}
}
