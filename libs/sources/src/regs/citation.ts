/**
 * Phase 3 -- CFR citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2 (`CorpusResolver.formatCitation`).
 *
 * Phase 3 ships the three styles `'short'`, `'formal'`, `'title'`. The values
 * are precomputed at ingestion time and stored on the `SourceEntry`; the
 * formatter just picks the right field. Token substitution (`@cite`, `@list`,
 * etc.) is the renderer's job in Phase 4.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `regs` citation. The fields are populated at ingestion time:
 *
 *   short   -> '§91.103'                          (or 'Subpart B', '14 CFR Part 91')
 *   formal  -> '14 CFR § 91.103'                  (or '14 CFR Part 91, Subpart B')
 *   title   -> 'Preflight action'                 (or 'Flight Rules')
 */
export function formatRegsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for regs entry: ${exhaustive as string}`);
		}
	}
}
