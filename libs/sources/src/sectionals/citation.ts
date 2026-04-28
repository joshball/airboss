/**
 * Phase 10 -- Sectionals citation formatter.
 *
 * Source of truth: ADR 019 §3.1, §2.2.
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

/**
 * Format a `sectionals` citation.
 *
 *   short   -> 'Denver Sectional'
 *   formal  -> 'Denver VFR Sectional Chart, FAA NACO (2026-04-23)'
 *   title   -> the chart's full catalog title
 */
export function formatSectionalsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for sectionals entry: ${exhaustive as string}`);
		}
	}
}
