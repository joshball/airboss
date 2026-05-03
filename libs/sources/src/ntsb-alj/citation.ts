/**
 * NTSB-ALJ citation formatter.
 *
 * Source of truth: WP-NTSB-ALJ spec at `docs/work-packages/wp-ntsb-alj/spec.md`.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format an `ntsb-alj` citation.
 *
 *   short   -> 'EA-5567'
 *   formal  -> 'NTSB Order EA-5567 (Administrator v. Doe)'
 *   title   -> the ruling's full case caption
 */
export function formatNtsbAljCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for ntsb-alj entry: ${exhaustive as string}`);
		}
	}
}
